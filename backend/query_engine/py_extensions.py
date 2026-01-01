import sys
import threading
import logging
from typing import Any, List, Dict, Iterable, IO, Optional
from jinja2 import nodes
from jinja2.ext import Extension
import textwrap
import os
import tempfile
import subprocess
import pathlib

# Import context_storage from reader_extensions to access shared state
# We use a try-except block to avoid circular import issues if this module is run as a script (e.g. in subprocess)
try:
    from .reader_extensions import context_storage, logger
except ImportError:
    # Fallback for when running as standalone script or in subprocess where reader_extensions isn't needed/available
    context_storage = None
    logger = logging.getLogger("PythonExtension")

try:
    import pyarrow as pa
    HAS_ARROW = True
except ImportError:
    pa = None
    HAS_ARROW = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    pd = None
    HAS_PANDAS = False

try:
    import polars as pl
    HAS_POLARS = True
except ImportError:
    pl = None
    HAS_POLARS = False

class ArrowConverter:
    """Helper class to convert various Python objects to Arrow Tables."""
    
    def __init__(self):
        pass

    def convert_to_arrow_table(self, input_data: Any) -> pa.Table:
        """Convert input data to Arrow Table"""
        if input_data is None:
             return pa.Table.from_pylist([])

        # Check for Arrow types
        if HAS_ARROW and pa is not None:
            if isinstance(input_data, pa.Table):
                return input_data
            if isinstance(input_data, pa.RecordBatch):
                return pa.Table.from_batches([input_data])
            # Check for list of RecordBatches
            if isinstance(input_data, list) and len(input_data) > 0 and isinstance(input_data[0], pa.RecordBatch):
                 return pa.Table.from_batches(input_data)

        # Check for pandas/polars DataFrames
        try:
            # Check for pandas DataFrame
            if HAS_PANDAS and pd is not None and isinstance(input_data, pd.DataFrame):
                return pa.Table.from_pandas(input_data, preserve_index=False)
            
            # Check for polars DataFrame
            if HAS_POLARS and pl is not None and isinstance(input_data, pl.DataFrame):
                return input_data.to_arrow()
        except Exception:
            # Ignore errors during specific type checks and fall through
            pass
        
        # Fallback: check by duck typing for .to_arrow() (e.g. Polars, other dataframe libs)
        if hasattr(input_data, 'to_arrow') and callable(getattr(input_data, 'to_arrow')):
            return input_data.to_arrow()
        
        # Fallback: check by duck typing for pandas-like (has index, columns, to_dict)
        if hasattr(input_data, 'index') and hasattr(input_data, 'columns') and hasattr(input_data, 'to_dict'):
             # Try to treat as pandas-like
             if HAS_PANDAS and pd is not None:
                try:
                    return pa.Table.from_pandas(input_data, preserve_index=False)
                except:
                    pass

        # Handle iterables (including lists of dicts, generators)
        # Must be last check because specialized types above might also be iterable
        if hasattr(input_data, '__iter__') and not isinstance(input_data, (str, bytes)):
            # Convert to list of records first to ensure we can iterate multiple times if needed for schema inference
            try:
                records = list(input_data)
            except Exception:
                 raise ValueError(f"Could not convert iterable to list: {type(input_data)}")

            if not records:
                # Empty input - return empty table
                return pa.table([])
            
            # Collect records into batches for efficient Arrow processing
            batch_size = 10000
            all_batches = []
            schema = None
            
            for i in range(0, len(records), batch_size):
                batch_records = records[i:i + batch_size]
                
                if schema is None:
                    schema = self._infer_arrow_schema(batch_records)
                
                batch = self._records_to_arrow_batch(batch_records, schema)
                all_batches.append(batch)
            
            if not all_batches:
                # No data - return empty table
                return pa.table([])
            
            # Combine all batches into a table
            return pa.Table.from_batches(all_batches, schema=schema)
        
        raise ValueError(f"Unsupported return type or failed conversion: {type(input_data)}")

    def _infer_arrow_schema(self, records: List[Dict[str, Any]]) -> pa.Schema:
        """Infer Arrow schema from a sample of records"""
        if not records:
            return pa.schema([])
        
        # Collect all unique field names
        field_names = set()
        for record in records[:100]:  # Sample first 100 records for schema inference
            if isinstance(record, dict):
                field_names.update(record.keys())
            else:
                 # Handle non-dict records if possible? 
                 # For now assuming list of dicts. If list of primitives, this will fail.
                 pass
        
        if not field_names and records:
             # Maybe list of scalars?
             return pa.schema([('value', self._infer_arrow_type(records[:100]))])

        fields = []
        for field_name in sorted(field_names):
            # Sample values for type inference
            sample_values = []
            for record in records[:100]:
                if isinstance(record, dict) and field_name in record and record[field_name] is not None:
                    sample_values.append(record[field_name])
            
            # Infer type from sample values
            arrow_type = self._infer_arrow_type(sample_values)
            fields.append(pa.field(field_name, arrow_type, nullable=True))
        
        return pa.schema(fields)

    def _infer_arrow_type(self, sample_values: List[Any]) -> pa.DataType:
        """Infer Arrow data type from sample values"""
        if not sample_values:
            return pa.string()
        
        # Check for boolean
        if all(isinstance(v, bool) for v in sample_values):
            return pa.bool_()
        
        # Check for int64
        if all(isinstance(v, int) and not isinstance(v, bool) for v in sample_values):
            return pa.int64()
        
        # Check for float64
        if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in sample_values):
            return pa.float64()
        
        # Check for timestamp
        import datetime
        if all(isinstance(v, datetime.datetime) for v in sample_values):
            return pa.timestamp('us')
        
        # Check for date
        if all(isinstance(v, datetime.date) for v in sample_values):
            return pa.date32()
        
        # Default to string
        return pa.string()

    def _records_to_arrow_batch(self, records: List[Dict[str, Any]], schema: pa.Schema) -> pa.RecordBatch:
        """Convert a list of records to an Arrow RecordBatch"""
        arrays = []
        
        # Handle scalar list case (single column named 'value')
        if len(schema) == 1 and schema[0].name == 'value' and records and not isinstance(records[0], dict):
             # Scalar conversion
             try:
                 return pa.RecordBatch.from_arrays([pa.array(records)], schema=schema)
             except:
                 # Fallback
                 return pa.RecordBatch.from_arrays([pa.array([str(r) for r in records])], schema=pa.schema([('value', pa.string())]))

        for field in schema:
            column_data = []
            for record in records:
                if isinstance(record, dict):
                    value = record.get(field.name)
                    column_data.append(value)
                else: 
                    column_data.append(None)
            
            # Create Arrow array with proper type conversion
            try:
                if field.type == pa.bool_():
                    array = pa.array(column_data, type=pa.bool_())
                elif field.type == pa.int64():
                    array = pa.array(column_data, type=pa.int64())
                elif field.type == pa.float64():
                    array = pa.array(column_data, type=pa.float64())
                elif field.type == pa.timestamp('us'):
                    array = pa.array(column_data, type=pa.timestamp('us'))
                elif field.type == pa.date32():
                    array = pa.array(column_data, type=pa.date32())
                else:
                    # Convert to string for safety
                    string_data = [str(v) if v is not None else None for v in column_data]
                    array = pa.array(string_data, type=pa.string())
            except Exception:
                # Fallback to string conversion if type conversion fails
                string_data = [str(v) if v is not None else None for v in column_data]
                array = pa.array(string_data, type=pa.string())
            
            arrays.append(array)
        
        return pa.record_batch(arrays, schema=schema)

class PythonExtension(Extension):
    """
    Custom python tag for executing arbitrary python code and registering results:
    {% python name='my_table' %}
    data = [{"id": 1, "value": "A"}]
    return data
    {% endpython %}
    """
    tags = {"python"}

    def parse(self, parser):
        lineno = next(parser.stream).lineno
        
        name_node = None
        
        while parser.stream.current.type != "block_end":
            if parser.stream.skip_if("comma"):
                continue
            
            # Check for name='value' syntax
            if parser.stream.current.type == 'name' and parser.stream.look().type == 'assign':
                key = parser.stream.current.value
                parser.stream.skip(2) # skip name and =
                val_node = parser.parse_expression()
                
                if key == 'name':
                    name_node = val_node
            else:
                # positional argument
                if name_node is None:
                    name_node = parser.parse_expression()
                else:
                    # ignore extra args or error? Just consume for now
                    parser.parse_expression()
        
        if name_node is None:
             name_node = nodes.Const("python_output")

        body = parser.parse_statements(["name:endpython"], drop_needle=True)

        return nodes.CallBlock(
            self.call_method("_register", [name_node]),
            [], [], body
        ).set_lineno(lineno)

    def _register(self, name, caller):
        code = caller()
        if not code.strip():
            raise ValueError("Python block is empty")
            
        dedented_code = textwrap.dedent(code)
        func_name = f"_python_block_{hash(code) & 0xFFFFFFFF}"
        indented_code = textwrap.indent(dedented_code, "    ")
        
        # Build a stanalone script wrapper
        # Read helper class content (this file itself)
        py_ext_path = pathlib.Path(__file__)
        try:
            with open(py_ext_path, "r", encoding="utf-8") as f:
                helper_code = f.read()
        except Exception as e:
            raise RuntimeError(f"Error reading py_extensions.py: {e}")

        # Build a stanalone script wrapper
        script_content = f"""
import sys
import pyarrow as pa
import json
import datetime
import os
import io

# Try imports
try:
    import pandas as pd
except ImportError:
    pd = None

# --- Injected Helper Class ---
{helper_code}
# -----------------------------

def {func_name}():
{indented_code}

if __name__ == "__main__":
    # Capture user stdout (print calls) and redirect to stderr with prefix for real-time parent streaming
    class StreamToStderr:
        def __init__(self, original_stderr):
            self.original_stderr = original_stderr
            self.line_buffer = ""
            self.capture_buffer = io.StringIO()
        
        def write(self, data):
            self.capture_buffer.write(data)
            self.line_buffer += data
            
            while "\\n" in self.line_buffer:
                line, rest = self.line_buffer.split("\\n", 1)
                # We format explicitly with newline to match parent's readline expectation
                self.original_stderr.write(f"__STDOUT__:{{line}}\\n")
                self.original_stderr.flush()
                self.line_buffer = rest
        
        def flush(self):
            if self.line_buffer:
                self.original_stderr.write(f"__STDOUT__:{{self.line_buffer}}\\n")
                self.line_buffer = ""
            self.original_stderr.flush()
            
        def getvalue(self):
            return self.capture_buffer.getvalue()

    original_stdout = sys.stdout
    original_stderr = sys.stderr
    
    streamer = StreamToStderr(original_stderr)
    sys.stdout = streamer

    try:
        result = {func_name}()
    except Exception as e:
        # Write error to stderr normally
        sys.stderr = original_stderr
        sys.stderr.write(str(e))
        sys.exit(1)
    finally:
        sys.stdout = original_stdout # Restore stdout for IPC

    try:
        converter = ArrowConverter()
        table = converter.convert_to_arrow_table(result)
        
        # We don't necessarily need to attach metadata for logs if we streamed them,
        # but let's attach full buffer just in case.
        user_stdout = streamer.getvalue()
        
        new_metadata = table.schema.metadata or {{}}
        if user_stdout:
             new_metadata[b'stdout'] = user_stdout.encode('utf-8')
        
        table = table.replace_schema_metadata(new_metadata)
        
        # Write schema and batches to stdout buffer
        with pa.ipc.new_stream(sys.stdout.buffer, table.schema) as writer:
            writer.write_table(table)
    except Exception as e:
        sys.stderr = original_stderr
        sys.stderr.write(str(e))
        sys.exit(1)
"""
        
        fd, script_path = tempfile.mkstemp(suffix=".py", prefix="py_ext_")
        os.write(fd, script_content.encode('utf-8'))
        os.close(fd)
        
        # Capture log_queue from current thread-local storage for use in reader thread
        log_queue = getattr(context_storage, "log_queue", None) if context_storage else None

        try:
            # Execute subprocess
            process = subprocess.Popen(
                [sys.executable, script_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True, # simplify reading strings
                bufsize=1, # Line buffered
                env={**os.environ, "PYTHONUNBUFFERED": "1"} # Force unbuffered output
            )
            
            # Streaming loop (read stderr while process running)
            # We need to read stdout (IPC) at the end, but stderr continuously
            # Since subprocess blocks, we can read chunks.
            # But process.stdout is for IPC table. That appears at END.
            
            # We can spawn a thread to read stderr or just use select/poll.
            # Thread is easiest for blocking reads.
            
            def stderr_reader():
                 while True:
                      line = process.stderr.readline()
                      if not line:
                          break
                          
                      if line.startswith("__STDOUT__:"):
                          content = line[11:] # remove prefix
                          # Mirror to terminal
                          print(content, end="", flush=True)
                          if log_queue:
                               log_queue.put(content)
                      else:
                          # Normal stderr (or error)
                          # Mirror to terminal
                          print(line, end="", file=sys.stderr, flush=True)
                          if log_queue:
                               log_queue.put(("[STDERR]: " + line))
            
            t_err = threading.Thread(target=stderr_reader)
            t_err.start()
            
            # Main thread waits for process. 
            # We also need to read stdout? Arrow IPC read waits for stream.
            arrow_table = None
            ipc_error = None
            
            try:
                # Open stream reader from stdout
                # This will BLOCK until script writes IPC or closes.
                # Meanwhile stderr_reader is streaming logs.
                reader = pa.ipc.open_stream(process.stdout.buffer) # Use binary buffer for IPC
                arrow_table = reader.read_all()
            except Exception as e:
                ipc_error = e

            process.wait()
            t_err.join() # Ensure we read all stderr
            
            if process.returncode != 0:
                 # We already streamed stderr line-by-line.
                 # But we should raise exception to stop execution.
                 raise RuntimeError(f"Python script exited with code {process.returncode}. See terminal for details.")

            if ipc_error:
                 if "Empty stream" in str(ipc_error):
                      pass # Valid if no table returned
                 else:
                      raise RuntimeError(f"Error reading IPC: {ipc_error}")

            # Register in DuckDB context
            if context_storage:
                ctx = getattr(context_storage, "db_conn", None)
                if ctx and arrow_table:
                    try:
                        ctx.execute(f"DROP VIEW IF EXISTS {name}")
                        ctx.execute(f"DROP TABLE IF EXISTS {name}")
                    except:
                        pass
                        
                    ctx.register(name, arrow_table)
                    
                    sid = getattr(context_storage, "session_id", "unknown")
                    logger.info(f"[{sid}] Registered result of '{name}'")
                    context_storage.has_side_effects = True
                    
                    # Log success (streamed)
                    row_count = arrow_table.num_rows
                    if hasattr(context_storage, "log_queue") and context_storage.log_queue:
                         context_storage.log_queue.put(f"\nTable '{name}' registered successfully ({row_count} rows).\n")
                    
                    return ""
            else:
                 return "-- Error: Context storage not available"
                
        except Exception as e:
            if hasattr(context_storage, "log_queue") and context_storage.log_queue:
                 context_storage.log_queue.put(f"\n[SYSTEM ERROR]: {e}\n")
            raise RuntimeError(f"System Error: {e}")
        finally:
            if os.path.exists(script_path):
                try:
                    os.remove(script_path)
                except:
                    pass
        
        return ""
