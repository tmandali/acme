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
import io
import shutil
import uuid
import logging
from datetime import datetime

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
        # Collect all unique field names, preserving order
        field_names = {}
        for record in records[:100]:  # Sample first 100 records for schema inference
            if isinstance(record, dict):
                for key in record.keys():
                    if key not in field_names:
                        field_names[key] = True
            else:
                 # Handle non-dict records if possible? 
                 # For now assuming list of dicts. If list of primitives, this will fail.
                 pass
        
        if not field_names and records:
             # Maybe list of scalars?
             return pa.schema([('value', self._infer_arrow_type(records[:100]))])

        fields = []
        for field_name in field_names:
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
        
        # In-Process Execution Strategy
        # We define a function wrapping the users code, then execute it.
        # This allows access to the existing process state (DuckDB connection).
        
        # 1. Prepare Execution Environment (Globals/Locals)
        
        # Get active DuckDB context from thread-local storage
        ctx = getattr(context_storage, "db_conn", None) if context_storage else None
        log_queue = getattr(context_storage, "log_queue", None) if context_storage else None
        
        # Custom print function to capture output in real-time
        def custom_print(*args, **kwargs):
            sep = kwargs.get('sep', ' ')
            end = kwargs.get('end', '\n')
            file = kwargs.get('file', None)
            
            msg = sep.join(map(str, args)) + end
            
            if file:
                try:
                    file.write(msg)
                except:
                    pass
                return

            if log_queue:
                # server.py handles strings as 'stdout'
                log_queue.put(msg)
            else:
                # Fallback logging
                logger.info(f"[USER PRINT]: {msg.strip()}")

        # Ensure imports are available
        try:
            import duckdb
        except ImportError:
            duckdb = None

        # Build namespace
        exec_globals = {
            "ctx": ctx,      # The request: active duckdb connection
            "duckdb": duckdb, 
            "pa": pa,
            "pd": pd,
            "json": __import__('json'),
            "datetime": __import__('datetime'),
            "print": custom_print
        }

        # 2. Def Function Wrapper
        # function_def = f"def {func_name}():\n{indented_code}"
        
        # We use a trick to compile with 'return' allowed: wrap in function
        script_full = f"""
def {func_name}():
{indented_code}
"""
        
        try:
            # Execute definition to create the function in exec_globals
            exec(script_full, exec_globals)
            
            # Retrieve the function
            user_func = exec_globals[func_name]
            
            # 3. Call Function
            result = user_func()
            
            # If no result returned (implicit None), we assume side-effects only and stop here.
            if result is None:
                return ""
                
            # Check for BinaryIO (File Download)
            if hasattr(result, 'read') and (isinstance(result, io.IOBase) or hasattr(result, 'getvalue')):
                try:
                    # Determine public path
                    # Assuming we are in backend/query_engine/py_extensions.py
                    # We want to go to frontend/public/temp_downloads
                    backend_root = pathlib.Path(__file__).parent.parent
                    project_root = backend_root.parent
                    public_dir = project_root / "frontend" / "public" / "temp_downloads"
                    
                    # Create a unique subdirectory to avoid name collisions and allow custom filenames
                    subdir_id = uuid.uuid4().hex
                    target_dir = public_dir / subdir_id
                    target_dir.mkdir(parents=True, exist_ok=True)
                    
                    # Determine filename
                    # name comes from the Jinja tag: {% python 'my_file.xlsx' %} -> name='my_file.xlsx'
                    # Default is 'python_output' if not specified
                    if name and name != "python_output":
                        safe_filename = pathlib.Path(name).name # Basic security: flatten path
                    else:
                        safe_filename = f"download_{datetime.now().strftime('%Y%m%d_%H%M%S')}.bin"
                        
                    file_path = target_dir / safe_filename
                    
                    # Automatically rewind the stream to the beginning
                    # This implies users don't need to do output.seek(0) manually
                    if hasattr(result, 'seek') and hasattr(result, 'tell'):
                        try:
                            # Only seek if we are at the end (or to be safe always seek 0)
                            # Checking tell() > 0 is good but seek(0) is safer for full download
                            result.seek(0)
                        except Exception:
                             # Some streams might not support seeking (e.g. sockets), but BytesIO does.
                             pass
                            
                    with open(file_path, 'wb') as f:
                        if hasattr(result, 'read'):
                            shutil.copyfileobj(result, f)
                        elif hasattr(result, 'getvalue'):
                            f.write(result.getvalue())
                            
                    # Register success message
                    msg = f"Dosya oluşturuldu. İndirmek için tıklayın."
                    if log_queue:
                         log_queue.put(f"\n[SYSTEM]: Binary output saved to {safe_filename}\n")
                    
                    # Return special marker for frontend
                    return f"-- [DOWNLOAD_FILE]:/temp_downloads/{subdir_id}/{safe_filename}"

                except Exception as e:
                    logger.error(f"Failed to save binary output: {e}")
                    if log_queue:
                        log_queue.put(f"[SYSTEM ERROR]: Failed to save binary output: {e}\n")
                    return ""
            
            # 4. Handle Result (Arrow Conversion & Registration)
            if context_storage and ctx:
                converter = ArrowConverter()
                table = None
                
                # A. Conversion Phase
                try:
                    table = converter.convert_to_arrow_table(result)
                except Exception as e:
                     # This is a user-data error (cannot convert what they returned)
                     if log_queue:
                         log_queue.put(f"[SYSTEM ERROR]: Failed to convert Python result to Arrow table: {e}\n")
                     logger.error(f"Failed to convert result: {e}")
                     return "" # Don't crash, just don't register

                # B. Registration Phase
                if table:
                    try:
                        # Drop existing
                        try:
                            ctx.execute(f"DROP VIEW IF EXISTS {name}")
                            ctx.execute(f"DROP TABLE IF EXISTS {name}")
                        except:
                            pass
                            
                        # Register New
                        try:
                             ctx.register(name, table)
                        except Exception as reg_err:
                             # Warning: DuckDB might fail if table has 0 columns
                             if log_queue:
                                  log_queue.put(f"[SYSTEM ERROR]: Failed to register result table '{name}' in DuckDB: {reg_err}\n")
                             raise reg_err

                        sid = getattr(context_storage, "session_id", "unknown")
                        logger.info(f"[{sid}] Registered result of '{name}'")
                        context_storage.has_side_effects = True
                        
                        row_count = table.num_rows
                        if log_queue:
                             log_queue.put(f"\nTable '{name}' registered successfully ({row_count} rows).\n")
                             
                    except Exception as e:
                        # Log but don't crash the server thread if possible, unless critical
                        logger.error(f"Registration error: {e}")
            
            return ""

        except Exception as e:
            # Runtime error in user code
            error_msg = str(e)
            if log_queue:
                 log_queue.put(("stderr", f"Error executing python block: {error_msg}\n"))
            logger.error(f"Python execution error: {e}", exc_info=True)
            # Propagate error to stop execution flow? 
            # Prefer showing error in log and returning empty string to avoid crushing entire server if possible
            # But server.py checks for exceptions in render_thread. 
            # If we raise, server catches it.
            raise RuntimeError(f"Python Script Error: {e}")
