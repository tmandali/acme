import sqlite3
import pathlib
import logging
import pyarrow as pa
from jinja2 import nodes
from jinja2.ext import Extension

logger = logging.getLogger("StreamFlightServer")

class ReaderExtension(Extension):
    """
    Custom reader tag: {% reader 'table_name', 'sqlite://path' %} ... {% endreader %}
    """
    tags = {"reader"}

    def parse(self, parser):
        lineno = next(parser.stream).lineno
        args = []
        
        # Support both parenthesized and non-parenthesized arguments
        if parser.stream.skip_if("lparen"):
             while parser.stream.current.type != "rparen":
                args.append(parser.parse_expression())
                if parser.stream.skip_if("comma"):
                    continue
                if parser.stream.current.type == "rparen":
                    break
             parser.stream.expect("rparen")
        else:
            while parser.stream.current.type != "block_end":
                if args:
                    parser.stream.skip_if("comma")
                args.append(parser.parse_expression())

        # Get body until endreader
        body = parser.parse_statements(["name:endreader"], drop_needle=True)
        
        return nodes.CallBlock(
            self.call_method("_register", args),
            [], [], body
        ).set_lineno(lineno)

    def _register(self, *args, caller):
        if len(args) < 2:
            return "-- Error: Reader tag requires table_name and connection_string"
        
        name, conn_str = args[0], args[1]
        inner_sql = caller().strip()
        if not inner_sql:
            return "-- Error: Reader block is empty"

        ctx = self.environment.globals.get("datafusion_ctx")
        if not ctx:
            return "-- Error: DataFusion context not found"

        # Resolve path
        db_path = self._resolve_db_path(conn_str)
        
        try:
            logger.debug(f"Reader tag connecting to: {db_path}")
            conn = sqlite3.connect(str(db_path))
            cursor = conn.execute(inner_sql)
            col_names = [col[0] for col in cursor.description]
            
            # Normalize column names
            normalized_field_names = [n.lower() for n in col_names]
            
            # Refresh schema
            try:
                ctx.deregister_table(name)
            except:
                pass

            batches = []
            while True:
                rows = cursor.fetchmany(1000)
                if not rows:
                    break
                
                cols = list(zip(*rows))
                batch = pa.RecordBatch.from_arrays(
                    [pa.array(c) for c in cols],
                    names=normalized_field_names
                )
                batches.append(batch)
            
            conn.close()

            if batches:
                ctx.register_record_batches(name, [batches])
                logger.info(f"Dynamically registered table '{name}' with {len(batches)} batches.")
            else:
                # Register empty table to prevent SQL errors
                fields = [pa.field(n, pa.string()) for n in normalized_field_names]
                schema = pa.schema(fields)
                empty_batch = pa.RecordBatch.from_arrays(
                    [pa.array([], type=pa.string()) for _ in normalized_field_names],
                    schema=schema
                )
                ctx.register_record_batches(name, [[empty_batch]])
            
            return "" 
        except Exception as e:
            err_msg = f"Error in reader tag: {str(e)}"
            logger.error(err_msg)
            return f"-- {err_msg}\n"

    def _resolve_db_path(self, conn_str):
        db_path_str = conn_str.replace("sqllite://", "").replace("sqlite://", "")
        db_path = pathlib.Path(db_path_str)
        
        if not db_path.is_absolute():
            if not db_path.exists():
                root = pathlib.Path(__file__).parent.parent
                alt_path = root / db_path_str
                if alt_path.exists():
                    db_path = alt_path
                elif db_path_str.startswith("backend/"):
                    alt_path = root / db_path_str.replace("backend/", "", 1)
                    if alt_path.exists():
                        db_path = alt_path
        return db_path
