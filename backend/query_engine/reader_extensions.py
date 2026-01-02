import sqlite3
import pathlib
import logging
import threading
import pyarrow as pa
from jinja2 import nodes
from jinja2.ext import Extension
from urllib.parse import urlparse, unquote
import textwrap

logger = logging.getLogger("StreamFlightServer")

# Thread-local storage to prevent race conditions during concurrent renders
context_storage = threading.local()

class ReaderExtension(Extension):
    """
    Custom reader tag: 
    {% reader 'table_name', 'sqlite://path' %} ... {% endreader %}
    {% reader 'table_name', 'mssql://user:pass@host:port/db' %} ... {% endreader %}
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
        logger.info(f"Reader tag registered with args: {args}")
        if len(args) < 2:
            return "-- Error: Reader tag requires table_name and connection_string"
        
        name, conn_str = args[0], args[1]
        # User requested no quoted usage. We expect booleans (TRUE/FALSE globals).
        use_parquet = bool(args[2]) if len(args) > 2 else False
        
        inner_sql = caller().strip()
        if not inner_sql:
            return "-- Error: Reader block is empty"

        # Use thread-local storage instead of global environment
        ctx = getattr(context_storage, "db_conn", None)
        conn_map = getattr(context_storage, "connection_map", {})
        
        # Mark side effects so server knows not to optimize
        context_storage.has_side_effects = True
        
        if not ctx:
            return "-- Error: Database context not found"

        # Resolve connection name if it's not a direct connection string
        if "://" not in conn_str:
            if conn_str in conn_map:
                conn_str = conn_map[conn_str]
            else:
                # Try case-insensitive match
                try:
                    metadata_db_path = getattr(context_storage, "db_path", "data.db")
                    with sqlite3.connect(metadata_db_path) as mconn:
                        res = mconn.execute("SELECT connection_string FROM _meta_connections WHERE name = ? COLLATE NOCASE", (conn_str,)).fetchone()
                        if res:
                            conn_str = res[0]
                except Exception as e:
                    logger.warning(f"DB lookup failed: {e}")
                
                # Check if we resolved it, if not, check map again
                if "://" not in conn_str:
                    for conn_name, cstr in conn_map.items():
                        if conn_name.lower() == conn_str.lower():
                            conn_str = cstr
                            break

        try:
            if conn_str.startswith("mssql://"):
                conn = self._connect_mssql(conn_str)
                cursor = conn.cursor()
                cursor.execute(inner_sql)
            else:
                db_path = self._resolve_db_path(conn_str)
                if not db_path.exists():
                     pass # Let it fail later or handle? ValueError
                
                logger.debug(f"Reader tag connecting to SQLite: {db_path}")
                conn = sqlite3.connect(str(db_path))
                cursor = conn.execute(inner_sql)
            
            col_names = [col[0] for col in cursor.description]

            # Deregister existing table if present
            try:
                ctx.execute(f"DROP VIEW IF EXISTS {name}")
                ctx.execute(f"DROP TABLE IF EXISTS {name}")
            except:
                pass

            batches = []
            
            is_inference = getattr(context_storage, "is_schema_inference", False)
            parquet_writer = None
            tmp_parquet_path = None
            
            if use_parquet and not is_inference:
                import tempfile
                import os
                import pyarrow.parquet as pq
                fd, tmp_parquet_path = tempfile.mkstemp(suffix=".parquet", prefix=f"{name}_")
                os.close(fd)

            try:
                while True:
                    rows = cursor.fetchmany(10000)
                    if not rows:
                        break
                    
                    cols = list(zip(*rows))
                    batch = pa.RecordBatch.from_arrays(
                        [pa.array(c) for c in cols],
                        names=col_names
                    )
                    
                    if use_parquet and not is_inference:
                         if parquet_writer is None:
                             parquet_writer = pq.ParquetWriter(
                                tmp_parquet_path, 
                                batch.schema, 
                                compression='snappy', 
                                use_dictionary=True,
                                data_page_size=1024*1024
                            )
                         parquet_writer.write_batch(batch)
                    else:
                        batches.append(batch)
                    
                    if is_inference:
                         break
            finally:
                if parquet_writer:
                    parquet_writer.close()
            
            conn.close()

            if use_parquet and not is_inference and parquet_writer is not None:
                 start_path = str(tmp_parquet_path).replace("'", "''")
                 ctx.execute(f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM '{start_path}'")
                 
                 sid = getattr(context_storage, "session_id", "unknown")
                 msg = f"[{sid}] Cached '{name}' to disk: {tmp_parquet_path}"
                 logger.info(msg)
                 return f"-- {msg}"

            if not batches and (not use_parquet or is_inference):
                if not batches and not parquet_writer:
                     fields = [pa.field(n, pa.string()) for n in col_names]
                     schema = pa.schema(fields)
                     empty_batch = pa.RecordBatch.from_arrays(
                         [pa.array([], type=pa.string()) for _ in col_names],
                         schema=schema
                     )
                     batches = [empty_batch]

            if use_parquet and is_inference:
                pass 

            if use_parquet and not is_inference and parquet_writer is None:
                 pass

            table = pa.Table.from_batches(batches)
            ctx.register(name, table)
            sid = getattr(context_storage, "session_id", "unknown")
            if is_inference:
                logger.info(f"[{sid}] Schema-only registration for '{name}' (1 batch)")
            else: 
                logger.info(f"[{sid}] Dynamically registered table '{name}' in-memory with {len(batches)} batches")
            return "" 
                
        except Exception as e:
            err_msg = f"Error in reader tag: {str(e)}"
            logger.error(err_msg, exc_info=True)
            return f"-- {err_msg}\n"

    def _connect_mssql(self, conn_str):
        import pymssql
        from urllib.parse import parse_qs
        
        u = urlparse(conn_str)
        password = unquote(u.password) if u.password else None
        user = unquote(u.username) if u.username else None
        
        query_params = parse_qs(u.query)
        charset = query_params.get('charset', [None])[0]
        
        database = u.path.lstrip('/')
        
        connect_args = {
            "server": u.hostname,
            "user": user,
            "password": password,
            "database": database,
            "port": u.port or 1433,
            "timeout": 10,
            "autocommit": True
        }
        
        if charset:
            connect_args["charset"] = charset
            
        return pymssql.connect(**connect_args)

    def _resolve_db_path(self, conn_str):
        db_path_str = conn_str.replace("sqllite://", "").replace("sqlite://", "").replace("sqlite3://", "")
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
