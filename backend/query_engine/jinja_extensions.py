import sqlite3
import pathlib
import logging
import threading
import pyarrow as pa
from jinja2 import nodes
from jinja2.ext import Extension
from urllib.parse import urlparse, unquote

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
        if len(args) < 2:
            return "-- Error: Reader tag requires table_name and connection_string"
        
        name, conn_str = args[0], args[1]
        use_parquet = args[2] if len(args) > 2 else False
        
        inner_sql = caller().strip()
        if not inner_sql:
            return "-- Error: Reader block is empty"

        # Use thread-local storage instead of global environment
        ctx = getattr(context_storage, "db_conn", None)
        conn_map = getattr(context_storage, "connection_map", {})
        
        if not ctx:
            return "-- Error: Database context not found"

        # Resolve connection name if it's not a direct connection string
        if "://" not in conn_str and conn_str in conn_map:
            conn_str = conn_map[conn_str]

        try:
            if conn_str.startswith("mssql://"):
                conn = self._connect_mssql(conn_str)
                cursor = conn.cursor()
                cursor.execute(inner_sql)
            else:
                db_path = self._resolve_db_path(conn_str)
                logger.debug(f"Reader tag connecting to SQLite: {db_path}")
                conn = sqlite3.connect(str(db_path))
                cursor = conn.execute(inner_sql)
            
            col_names = [col[0] for col in cursor.description]
            normalized_field_names = [n.lower() for n in col_names]

            # Deregister existing table if present (DuckDB specific)
            try:
                ctx.execute(f"DROP VIEW IF EXISTS {name}")
                ctx.execute(f"DROP TABLE IF EXISTS {name}")
            except:
                pass

            batches = []
            while True:
                rows = cursor.fetchmany(10000) # Increased batch size for efficiency
                if not rows:
                    break
                
                cols = list(zip(*rows))
                batch = pa.RecordBatch.from_arrays(
                    [pa.array(c) for c in cols],
                    names=normalized_field_names
                )
                batches.append(batch)
            
            conn.close()

            if not batches:
                # Handle empty result
                fields = [pa.field(n, pa.string()) for n in normalized_field_names]
                schema = pa.schema(fields)
                empty_batch = pa.RecordBatch.from_arrays(
                    [pa.array([], type=pa.string()) for _ in normalized_field_names],
                    schema=schema
                )
                batches = [empty_batch]

            if use_parquet:
                import tempfile
                import os
                import pyarrow.parquet as pq
                
                # Create a temporary file
                fd, tmp_path = tempfile.mkstemp(suffix=".parquet", prefix=f"{name}_")
                os.close(fd)
                
                # Write batches to parquet with optimized settings
                if batches:
                    schema = batches[0].schema
                    # Performans ayarları: Snappy sıkıştırma, dictionary encoding ve uygun page size
                    with pq.ParquetWriter(
                        tmp_path, 
                        schema, 
                        compression='snappy', 
                        use_dictionary=True,
                        data_page_size=1024*1024  # 1MB
                    ) as writer:
                        for batch in batches:
                            writer.write_batch(batch)
                
                # Register parquet file using DuckDB
                # escaping path for SQL safety not critical for internal temp path but good practice
                start_path = str(tmp_path).replace("'", "''")
                ctx.execute(f"CREATE OR REPLACE VIEW {name} AS SELECT * FROM '{start_path}'")
                
                msg = f"Cached '{name}' to disk: {tmp_path}"
                logger.info(msg)
                return f"-- {msg}" # Return as comment so it might be visible if we parse comments
            else:
                # Register in-memory (Zero-copy)
                table = pa.Table.from_batches(batches)
                ctx.register(name, table)
                logger.info(f"Dynamically registered table '{name}' in-memory with {len(batches)} batches")
                return "" 
                
        except Exception as e:
            err_msg = f"Error in reader tag: {str(e)}"
            logger.error(err_msg, exc_info=True)
            return f"-- {err_msg}\n"

    def _connect_mssql(self, conn_str):
        import pymssql
        u = urlparse(conn_str)
        # Handle URL encoded characters in password
        password = unquote(u.password) if u.password else None
        user = unquote(u.username) if u.username else None
        
        database = u.path.lstrip('/')
        # Extract additional params like encrypt=true
        # pymssql doesn't support them all natively in connect() but we handle the basics
        return pymssql.connect(
            server=u.hostname,
            user=user,
            password=password,
            database=database,
            port=u.port or 1433,
            timeout=10,
            autocommit=True
        )

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
