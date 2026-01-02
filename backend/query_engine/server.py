import json
import sqlite3
import pathlib
import yaml
import logging
import duckdb
import pyarrow as pa
import pyarrow.flight
from datetime import datetime
from dataclasses import asdict
from jinja2 import Environment, FileSystemLoader
from faker import Faker
import queue
import threading
import io

from .models import QueryCommand, SqlWrapper, TemplateMetadata
from .reader_extensions import ReaderExtension, context_storage
from .py_extensions import PythonExtension
from .filters import (
    filter_quote, filter_sql, filter_between, filter_eq, filter_add_days,
    filter_gt, filter_lt, filter_gte, filter_lte, filter_ne, filter_like,
    filter_start, filter_end
)

# Logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("StreamFlightServer")

class StreamFlightServer(pa.flight.FlightServerBase):
    def __init__(self, location="grpc://0.0.0.0:8815", query_dirs=None, db_path="data.db", **kwargs):
        self.external_conns = kwargs.pop("external_conns", [])
        super(StreamFlightServer, self).__init__(location, **kwargs)
        self.location = location
        self.db_path = db_path
        self.query_dirs = query_dirs or [
            pathlib.Path("../app/sql-query/query")
        ]
        
        # 3. Initialize Shared Database (SQLite) and Metadata
        self._init_metadata_db()
        self._sync_external_connections()
        
        # Initialize internal structures
        self.connections = {}
        self.connection_map = {}
        
        # 1. Initialize Sessions
        self._sessions = {}
        self._max_sessions = 100
        
        # 2. Setup Template Engine (Jinja)
        self._setup_jinja()

        self._load_connections()

    def _sync_external_connections(self):
        """Seeds external connections into the SQLite DB if they don't exist."""
        if not isinstance(self.external_conns, dict):
            return

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        for name, cstr in self.external_conns.items():
            # Attempt to insert. If name exists, it will fail silently due to OR IGNORE (name is UNIQUE)
            # We treat external_conns as 'System' type initial seeds
            cursor.execute(
                "INSERT OR IGNORE INTO _meta_connections (name, type, connection_string) VALUES (?, ?, ?)",
                (name, "system", cstr)
            )
            
        conn.commit()
        conn.close()

    def _init_metadata_db(self):
        """Initializes metadata tables in the SQLite database."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS _meta_connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                type TEXT NOT NULL,
                connection_string TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    def _load_connections(self):
        """Loads connections from metadata table into memory."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT id, name, type, connection_string FROM _meta_connections")
        for row in cursor.fetchall():
            cid, name, ctype, cstr = row
            # Use string ID for consistency
            self.connections[str(cid)] = cstr
            self.connection_map[name] = cstr
        conn.close()

    # ... (skipping unchanged methods until do_get)

    def do_get(self, context, ticket):
        try:
            cmd = QueryCommand.from_json(ticket.ticket.decode())
            
            # Always Initialize Session Context First
            # This is required for Jinja rendering (ReaderExtension needs ctx)
            ctx = self._get_session_context(cmd.session_id)
            
            # Render the query (resolves Jinja tags, variables, and potential file templates)
            sql = self._render_query(cmd, ctx)
            
            # Check if SQL is effectively empty (only comments or whitespace)
            clean_lines = []
            comment_lines = []
            if sql:
                for line in sql.splitlines():
                    stripped = line.strip()
                    if not stripped:
                        continue
                    if stripped.startswith("--"):
                        comment_lines.append(stripped[2:].strip())
                    else:
                        clean_lines.append(line)
            
            is_effectively_empty = len(clean_lines) == 0

            if is_effectively_empty:
                 # Construct message from comments or default
                 msg = "İşlem başarıyla tamamlandı."
                 
                 # Check for Python stdout capture (from PythonExtension)
                 python_stdout = getattr(context_storage, "python_stdout", None)
                 if python_stdout:
                     msg = python_stdout.strip()
                 elif comment_lines:
                     msg = "\n".join(comment_lines)

                 # Return single row with message
                 batch = pa.RecordBatch.from_arrays(
                     [pa.array([msg])],
                     names=["Result"]
                 )
                 # Note: Provide a schema even for empty results to avoid client confusion
                 return pa.flight.RecordBatchStream(pa.RecordBatchReader.from_batches(batch.schema, [batch]))

            # Direct connection execution (Post-Render)
            if cmd.connection_id and cmd.connection_id != "default":
                target_conn = self.connections.get(str(cmd.connection_id))
                if target_conn:
                    logger.info(f"Executing rendered query on connection {cmd.connection_id}")
                    return self._execute_on_external(target_conn, sql)
                else:
                    logger.warning(f"Connection ID {cmd.connection_id} not found. Falling back to default.")

            # DuckDB execution
            # Connect execution (Post-Render) happens here
            
            # Execute and get relation
            rel = ctx.sql(sql)

            if rel is None:
                # DDL executed successfully but returned no relation
                batch = pa.RecordBatch.from_arrays(
                     [pa.array(["İşlem başarıyla tamamlandı."])],
                     names=["Result"]
                 )
                return pa.flight.RecordBatchStream(pa.RecordBatchReader.from_batches(batch.schema, [batch]))
            
            # Stream result as Arrow
            # fetch_arrow_reader returns a pyarrow.RecordBatchReader
            reader = rel.fetch_arrow_reader(batch_size=1024)
            
            return pa.flight.RecordBatchStream(reader)
        except Exception as e:
            logger.exception("Query execution failed")
            # Clean up error message for display
            msg = str(e)
            
            # Remove DuckDB specific prefixes if any (DuckDB usually gives clean errors but just in case)
            duckdb_prefixes = [
                "Binder Error: ", "Catalog Error: ", "Parser Error: ",
                "Constraint Error: ", "Conversion Error: ", "Data Error: ",
                "Transaction Error: ", "IO Error: ", "Connection Error: ",
                "Internal Error: ", "Standard Error: ", "Sequence Error: "
            ]
            for prefix in duckdb_prefixes:
                if prefix in msg:
                    msg = msg.replace(prefix, "")
            
            # Remove Python traceback details if present (often starts with Detail: Python exception:)
            if "Detail: Python exception" in msg:
                msg = msg.split("Detail: Python exception")[0].strip()
            
            # Handle standard "Table '...' already exists" or "doesn't exist" clean up if regex didn't catch it perfectly
            if "already exists" in msg or "doesn't exist" in msg:
                 # Try to keep just the relevant part if there's still noise
                 pass

            raise pa.flight.FlightServerError(msg)

    def _execute_on_external(self, conn_str, query):
        """Executes query directly on external connection and returns Flight stream."""
        conn = None
        try:
            if conn_str.startswith("mssql://"):
                import pymssql
                from urllib.parse import urlparse, unquote
                u = urlparse(conn_str)
                conn = pymssql.connect(
                    server=u.hostname,
                    user=unquote(u.username) if u.username else None,
                    password=unquote(u.password) if u.password else None,
                    database=u.path.lstrip('/'),
                    port=u.port or 1433,
                    autocommit=True
                )
                cursor = conn.cursor()
                cursor.execute(query)
            
            elif conn_str.startswith("postgres://") or conn_str.startswith("postgresql://"):
                import psycopg2
                conn = psycopg2.connect(conn_str)
                cursor = conn.cursor()
                cursor.execute(query)

            elif conn_str.startswith("sqlite://") or "://" not in conn_str:
                import sqlite3
                db_path = conn_str.replace("sqlite://", "").replace("sqlite3://", "")
                conn = sqlite3.connect(db_path)
                cursor = conn.execute(query)
            else:
                 raise ValueError(f"Unsupported connection protocol in: {conn_str}")

            # Get column names
            col_names = [col[0] for col in cursor.description or []]
            if not col_names:
                # No result (e.g. INSERT)
                schema = pa.schema([])
                return pa.flight.RecordBatchStream(pa.RecordBatchReader.from_batches(schema, []))

            normalized_names = [n.lower() for n in col_names]
            
            # Fetch first batch to infer schema
            first_rows = cursor.fetchmany(1000)
            if not first_rows:
                fields = [pa.field(n, pa.string()) for n in normalized_names] 
                schema = pa.schema(fields)
                return pa.flight.RecordBatchStream(pa.RecordBatchReader.from_batches(schema, []))

            cols = list(zip(*first_rows))
            # Convert to PyArrow arrays with type inference
            # We might need to handle specific types like Decimal or Date better here
            arrays = []
            for c in cols:
                # Basic handling to ensure compatibility, PyArrow is usually good at inferring
                arrays.append(pa.array(c))

            first_batch = pa.RecordBatch.from_arrays(
                arrays,
                names=normalized_names
            )
            schema = first_batch.schema

            def batch_gen():
                yield first_batch
                while True:
                    rows = cursor.fetchmany(1000)
                    if not rows: break
                    cols = list(zip(*rows))
                    yield pa.RecordBatch.from_arrays([pa.array(c) for c in cols], schema=schema)
                conn.close()

            return pa.flight.RecordBatchStream(pa.RecordBatchReader.from_batches(schema, batch_gen()))
            
        except Exception as e:
            logger.error(f"External execution failed: {e}")
            if conn: conn.close()
            
            # Clean up error message (especially for pymssql which returns tuples/bytes)
            msg = str(e)
            if isinstance(e.args, tuple) and len(e.args) > 1 and isinstance(e.args[1], bytes):
                try:
                    # pymssql error format: (code, b"Message")
                    msg = e.args[1].decode('utf-8', errors='replace')
                except:
                    pass
            
            raise pa.flight.FlightServerError(msg)
        self._max_sessions = 100
        
        # 2. Setup Template Engine (Jinja)
        self._setup_jinja()
        
        # 3. Initialize Shared Database (SQLite)
        #self._init_db()

    def _get_session_context(self, session_id: str) -> duckdb.DuckDBPyConnection:
        """Returns existing or creates a new isolated SessionContext for the user."""
        if session_id in self._sessions:
            return self._sessions[session_id]

        # Cleanup if too many sessions
        if len(self._sessions) >= self._max_sessions:
            oldest = next(iter(self._sessions))
            del self._sessions[oldest]

        logger.info(f"Creating new session context for: {session_id}")
        # Create an in-memory DuckDB connection
        # We can also use a persistent file if needed, but in-memory is good for session isolation
        ctx = duckdb.connect(":memory:")
        
        # Install and load generic extensions if needed (e.g. httpfs, spatial)
        # ctx.install_extension("httpfs")
        # ctx.load_extension("httpfs")
        
        # Register default tables for this new session
        #self._register_tables_in_datafusion(ctx)
        #self._register_external_conns(ctx)
        
        self._sessions[session_id] = ctx
        return ctx

    def _setup_jinja(self):
        self.jinja_env = Environment(
            loader=FileSystemLoader([str(d) for d in self.query_dirs]),
            extensions=[ReaderExtension, PythonExtension]
        )
        # Shared utilities
        self.jinja_env.globals["now"] = datetime.now().strftime("%Y%m%d")
        self.jinja_env.globals["zip"] = zip
        
        # Boolean aliases for case-insensitivity in templates
        self.jinja_env.globals.update({
            "TRUE": True, "FALSE": False,
            "True": True, "False": False
        })
        
        # Register Filters
        filters = {
            "quote": filter_quote, "sql": filter_sql, "between": filter_between,
            "eq": filter_eq, "add_days": filter_add_days, "gt": filter_gt,
            "lt": filter_lt, "gte": filter_gte, "ge": filter_gte,
            "lte": filter_lte, "le": filter_lte, "ne": filter_ne,
            "like": filter_like, "start": filter_start, "begin": filter_start,
            "end": filter_end, "finish": filter_end
        }
        self.jinja_env.filters.update(filters)

    # def _init_db(self):
    #     """Ensures the SQLite database exists and has seed data."""
    #     logger.info(f"Initializing database at {self.db_path}")
    #     conn = sqlite3.connect(self.db_path)
    #     fake = Faker()
        
    #     # Check if regeneration is needed
    #     try:
    #         cursor = conn.execute("SELECT COUNT(*) FROM ACCOUNTS")
    #         count = cursor.fetchone()[0]
    #         if count >= 50000:
    #             conn.close()
    #             return
    #     except Exception:
    #         pass

    #     logger.info("Generating seed data...")
    #     conn.executescript("""
    #         DROP TABLE IF EXISTS ACCOUNTS;
    #         DROP TABLE IF EXISTS TRANSACTIONS;
    #         CREATE TABLE ACCOUNTS (ID INTEGER PRIMARY KEY, NAME TEXT, EMAIL TEXT, ADDRESS TEXT, STATE TEXT, CREATED_AT TEXT);
    #         CREATE TABLE TRANSACTIONS (ID INTEGER PRIMARY KEY, ACCOUNT_ID INTEGER, AMOUNT REAL, CURRENCY TEXT, DESCRIPTION TEXT, DATE TEXT);
    #     """)

    #     # Accounts
    #     accs = [(i, fake.name(), fake.email(), fake.address().replace('\n', ', '), fake.state_abbr(), 
    #              fake.date_between(start_date='-2y', end_date='today').strftime('%Y%m%d')) for i in range(1, 50001)]
    #     conn.executemany("INSERT INTO ACCOUNTS VALUES (?,?,?,?,?,?)", accs)

    #     # Transactions
    #     txns = []
    #     for acc_id in range(1, 50001):
    #         for _ in range(fake.random_int(0, 3)):
    #             txns.append((None, acc_id, round(fake.random.uniform(10, 5000), 2), fake.currency_code(), fake.bs(),
    #                          fake.date_between(start_date='-1y', end_date='today').strftime('%Y%m%d')))
    #     conn.executemany("INSERT INTO TRANSACTIONS VALUES (?,?,?,?,?,?)", txns)
        
    #     conn.commit()
    #     conn.close()
    #     conn.close()

    # def _register_tables_in_datafusion(self, ctx: duckdb.DuckDBPyConnection, target_table_name: str = None):
    #     """Pre-registers SQLite tables in a specific context for visibility."""
    #     logger.info(f"Registering SQLite tables in session...")
    #     conn = sqlite3.connect(self.db_path)
    #     if target_table_name:
    #         # Check if this table exists in SQLite
    #         cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name) = LOWER(?)", (target_table_name,))
    #         tables = [r[0] for r in cursor.fetchall()]
    #     else:
    #         cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    #         tables = [r[0] for r in cursor.fetchall()]
        
    #     for table_name in tables:
    #         try:
    #             cursor = conn.execute(f"SELECT * FROM {table_name}")
    #             col_names = [col[0] for col in cursor.description]
    #             normalized_names = [n.lower() for n in col_names]
                
    #             # Create arrow table from all data (DuckDB handles arrow efficiently)
    #             # For very large tables, we might want to use DuckDB's sqlite scanner instead if installed
    #             # But for now, read into Arrow
    #             rows = cursor.fetchall()
    #             if rows:
    #                 cols = list(zip(*rows))
    #                 arrow_table = pa.Table.from_arrays(
    #                     [pa.array(c) for c in cols],
    #                     names=normalized_names
    #                 )
    #                 ctx.register(table_name.lower(), arrow_table)
    #                 logger.info(f"Pre-registered local table '{table_name.lower()}'")
    #         except Exception as e:
    #             logger.warning(f"Failed to pre-register {table_name}: {e}")
        
    #     conn.close()

    # def _register_external_conns(self, ctx: datafusion.SessionContext, target_table_name: str = None):
    #     """Discovers and registers tables from external connections (e.g. MSSQL)."""
    #     if not self.external_conns:
    #         return

    #     for conn_str in self.external_conns:
    #         try:
    #             if conn_str.startswith("mssql://"):
    #                 logger.info(f"Discovering tables from MSSQL: {conn_str[:20]}...")
    #                 # Temporarily use ReaderExtension's connection logic
    #                 from .jinja_extensions import ReaderExtension
    #                 ext = ReaderExtension(self.jinja_env)
    #                 conn = ext._connect_mssql(conn_str)
    #                 cursor = conn.cursor()
    #                 if target_table_name:
    #                     # Find the correct casing in MSSQL for the requested table name
    #                     cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND LOWER(TABLE_NAME) = LOWER(%s)", (target_table_name,))
    #                     tables = [r[0] for r in cursor.fetchall()]
    #                     if not tables:
    #                         logger.info(f"Table '{target_table_name}' not found in external connection {conn_str[:20]}")
    #                         conn.close()
    #                         continue
    #                 else:
    #                     # Discover user tables in MSSQL
    #                     cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
    #                     tables = [r[0] for r in cursor.fetchall()]
                    
    #                 for table_name in tables:
    #                     try:
    #                         # Fetch all data in batches (consistent with ReaderExtension)
    #                         cursor.execute(f"SELECT * FROM {table_name}")
    #                         col_names = [col[0] for col in cursor.description]
    #                         normalized_names = [n.lower() for n in col_names]
                            
    #                         batches = []
    #                         while True:
    #                             rows = cursor.fetchmany(1000)
    #                             if not rows:
    #                                 break
                                
    #                             cols = list(zip(*rows))
    #                             batches.append(pa.RecordBatch.from_arrays(
    #                                 [pa.array(c) for c in cols],
    #                                 names=normalized_names
    #                             ))
                            
    #                         if batches:
    #                             ctx.register_record_batches(table_name.lower(), [batches])
    #                             logger.info(f"Pre-registered remote MSSQL table '{table_name.lower()}'")
    #                         else:
    #                             # Empty table schema
    #                             fields = [pa.field(n, pa.string()) for n in normalized_names]
    #                             schema = pa.schema(fields)
    #                             empty_batch = pa.RecordBatch.from_arrays([pa.array([], type=pa.string()) for _ in normalized_names], schema=schema)
    #                             ctx.register_record_batches(table_name.lower(), [[empty_batch]])
    #                     except Exception as inner_e:
    #                         logger.warning(f"Failed to register remote table {table_name}: {inner_e}")
    #                 conn.close()
    #         except Exception as e:
    #             logger.error(f"Failed to connect to external source: {e}")

    def _render_query(self, cmd: QueryCommand, ctx: duckdb.DuckDBPyConnection) -> str:
        """Processes Jinja templates into SQL strings using specific session context."""
        if cmd.already_rendered:
            return cmd.query

        # Use thread-local storage accessable by ReaderExtension
        # This prevents race conditions in multi-threaded environment where
        # global environment variables would be overwritten.
        context_storage.db_conn = ctx
        context_storage.connection_map = self.connection_map
        context_storage.session_id = cmd.session_id
        context_storage.python_stdout = "" # Clear captured stdout
        
        criteria = {k: SqlWrapper(v, k, jinja_env=self.jinja_env) for k, v in cmd.criteria.items()}
        
        source = cmd.query
        if not source and cmd.template:
            for d in self.query_dirs:
                p = d / cmd.template
                if p.exists():
                    with open(p, 'r', encoding='utf-8') as f:
                        source = yaml.safe_load(f).get('sql', '')
                    break
        
        if not source:
            raise FileNotFoundError(f"Query source not found for template: {cmd.template}")

        try:
            template = self.jinja_env.from_string(source)
            return template.render(**criteria)
        except Exception as e:
            logger.exception("Template rendering failed")
            raise

    def list_flights(self, context, criteria):
        seen = set()
        for q_dir in self.query_dirs:
            if not q_dir.exists(): continue
            for path in q_dir.glob("*.yaml"):
                if path.name in seen: continue
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        meta = TemplateMetadata.from_dict(path.name, yaml.safe_load(f))
                    seen.add(path.name)
                    desc = pa.flight.FlightDescriptor.for_command(json.dumps({"template": meta.name, "metadata": asdict(meta)}).encode())
                    yield pa.flight.FlightInfo(pa.schema([]), desc, [pa.flight.FlightEndpoint(desc.command, [self.location])], -1, -1)
                except Exception:
                    continue

    def get_flight_info(self, context, descriptor):
        cmd = QueryCommand.from_json(descriptor.command.decode())
        
        # Check if this is a direct external connection query
        if cmd.connection_id and cmd.connection_id != "default":
            # Just return a placeholder FlightInfo to allow execution to proceed to do_get.
            # Real schema discovery would happen in do_get stream or we could try to implement it here.
            if self.connections.get(str(cmd.connection_id)):
                return pa.flight.FlightInfo(
                    pa.schema([]), # Empty schema/unknown
                    descriptor, 
                    [pa.flight.FlightEndpoint(pa.flight.Ticket(descriptor.command), [self.location])], 
                    -1, 
                    -1
                )
        
        ctx = self._get_session_context(cmd.session_id)
        
        # Optimize: Tell extensions we only need schema
        context_storage.is_schema_inference = True
        context_storage.has_side_effects = False
        
        try:
            sql = self._render_query(cmd, ctx)
        finally:
            context_storage.is_schema_inference = False
        
        # Determine Ticket Strategy
        # If no side effects (e.g. Reader Extensions) happened, we can safely pass the rendered SQL
        # to DoGet, saving a second render pass.
        # If side effects happened, DoGet MUST re-render to trigger appropriate "Full Load" side effects.
        has_side_effects = getattr(context_storage, "has_side_effects", False)
        
        if not has_side_effects and sql and sql.strip():
             # Create optimized command
             optimized_cmd = QueryCommand(
                 template="", # No template
                 query=sql,   # Rendered SQL
                 criteria={}, # No criteria needed
                 session_id=cmd.session_id,
                 connection_id=cmd.connection_id,
                 already_rendered=True
             )
             ticket_payload = json.dumps(asdict(optimized_cmd)).encode()
        else:
             # Fallback to original command (re-render in DoGet)
             # Explicitly re-serialize to ensure session_id is always explicit in ticket
             ticket_payload = json.dumps(asdict(cmd)).encode()
        
        if not sql or not sql.strip():
            # User likely only used {% reader %} or {% macro %} blocks without a query
            logger.info("Empty SQL after rendering. Returning informative placeholder.")
            return pa.flight.FlightInfo(
                 pa.schema([("Result", pa.string())]), 
                 descriptor, 
                 [pa.flight.FlightEndpoint(pa.flight.Ticket(ticket_payload), [self.location])], 
                 -1, 
                 -1
            )
            
        # Check for comment-only SQL
        clean = [l for l in sql.splitlines() if l.strip() and not l.strip().startswith("--")]
        if not clean:
             logger.info("Comment-only SQL. Returning informative placeholder.")
             return pa.flight.FlightInfo(
                 pa.schema([("Result", pa.string())]), 
                 descriptor, 
                 [pa.flight.FlightEndpoint(pa.flight.Ticket(ticket_payload), [self.location])], 
                 -1, 
                 -1
            )
        try:
            # Check for non-SELECT statements by inspecting the SQL string first
            # Use simple string check to avoid DataFusion planning overhead/errors for DDL
            sql_upper = sql.strip().upper()
            is_modification_sql = (
                sql_upper.startswith("CREATE") or
                sql_upper.startswith("INSERT") or
                sql_upper.startswith("UPDATE") or
                sql_upper.startswith("DELETE") or
                sql_upper.startswith("DROP")
            )

            if is_modification_sql:
                logger.info(f"Skipping schema inference for modification query (SQL check): {sql[:50]}...")
                return pa.flight.FlightInfo(
                    pa.schema([("result", pa.string())]), 
                    descriptor, 
                    [pa.flight.FlightEndpoint(pa.flight.Ticket(ticket_payload), [self.location])], 
                    -1, 
                    -1
                )



            # Use DuckDB to infer schema. 
            # executing with limit 0 is a cheap way to get schema without running full query
            # However for correct DDL/DML detection we might still roughly parse.
            
            # DuckDB allows DESCRIBE or just limit 0
            rel = ctx.sql(sql)
            # Fetch empty arrow table to get schema
            try:
                arrow_schema = rel.limit(0).arrow().schema
                return pa.flight.FlightInfo(arrow_schema, descriptor, [pa.flight.FlightEndpoint(pa.flight.Ticket(ticket_payload), [self.location])], -1, -1)
            except Exception as e:
                # If limit 0 fails (e.g. multiple statements?), try to just execute it? 
                # Or it might be a DDL/DML command.
                logger.info(f"Limit 0 failed for schema inference ({e}). Returning empty schema result.")
                return pa.flight.FlightInfo(
                    pa.schema([("result", pa.string())]), 
                    descriptor, 
                    [pa.flight.FlightEndpoint(pa.flight.Ticket(ticket_payload), [self.location])], 
                    -1, 
                    -1
                )
        except Exception as e:
            logger.error(f"Schema inference failed for session {cmd.session_id}. Error: {e}. SQL:\n{sql}", exc_info=True)
            # If planning fails (e.g. table doesn't exist yet but will be created), 
            # we might want to let it fail in do_get, but for now reporting error is safer.
            raise pa.flight.FlightServerError(f"Error: {e}")

    def do_get(self, context, ticket):
        query = ticket.ticket.decode('utf-8')
        
        # Parse ticket (JSON or plain text)
        try:
            request_data = json.loads(query)
            
            # Check if it looks like our command structure
            if isinstance(request_data, dict) and 'query' in request_data:
                 query_sql = request_data.get('query', '')
                 criteria = request_data.get('criteria', {})
                 # Handle mixed case keys (frontend sends camelCase, internal might be snake_case)
                 connection_id = request_data.get('connectionId') or request_data.get('connection_id')
                 session_id = request_data.get('sessionId') or request_data.get('session_id')
            else:
                 # Valid JSON but not our expected object (e.g. plain string "SELECT...")
                 if isinstance(request_data, str):
                     query_sql = request_data
                 else:
                     query_sql = query # parsing artifact? fallback to raw
                 
                 connection_id = None
                 session_id = None
        except:
             # Not JSON, treat as plain text SQL
             query_sql = query
             connection_id = None
             session_id = None

        if not session_id:
             # Try header if not in ticket
             try:
                 # Check if invocation_metadata exists and is callable
                 if hasattr(context, 'invocation_metadata'):
                     headers = {k.lower(): v for k, v in context.invocation_metadata()}
                     session_id = headers.get('x-session-id', 'default')
                 else:
                     # Fallback or try other attributes?
                     # Debugging: Log what's available
                     logger.warning(f"ServerCallContext has no invocation_metadata. Dir: {dir(context)}")
                     session_id = 'default'
             except Exception as e:
                 logger.warning(f"Failed to access context headers: {e}")
                 session_id = 'default'

        
        # Ensure session and get connection
        db_conn = self._get_session_context(session_id)
        
        # Setup context storage
        context_storage.db_conn = db_conn
        context_storage.connection_map = self.connection_map
        context_storage.session_id = session_id
        context_storage.python_stdout = ""
        context_storage.has_side_effects = False
        
        # Setup Log Streaming Queue
        log_queue = queue.Queue()
        context_storage.log_queue = log_queue

        # Result container for thread
        render_result = {"sql": None, "error": None}
        
        # Construct Command Object for _render_query
        cmd = QueryCommand(
            template="", # No template for direct query
            query=query_sql,
            criteria=criteria,
            session_id=session_id,
            connection_id=connection_id
        )

        def render_thread_target():
            try:
                # Initialize thread-local context for this new thread
                context_storage.log_queue = log_queue
                
                # Render Jinja (Runs python blocks which create logs)
                # Use db_conn from closure, not context_storage (which is empty here initially)
                render_result["sql"] = self._render_query(cmd, db_conn)
            except Exception as e:
                render_result["error"] = e
            finally:
                # Signal done
                log_queue.put(None)

        # Start rendering in background thread
        t = threading.Thread(target=render_thread_target)
        t.start()
        
        # Wait for the first signal (Log or Done)
        # This decides our Schema strategy
        first_item = log_queue.get()
        
        # Define Log Schema
        log_schema = pa.schema([
            pa.field("stream_type", pa.string()),
            pa.field("stream_content", pa.string())
        ])

        if first_item is not None:
            # OPTION 1: LOG STREAMING MODE
            # We have logs/output from script. 
            # We MUST use log_schema for the entire stream to avoid mixed-schema crash.
            # If there is a final SQL result later, we have to convert it to text/log.
            
            def log_generator():
                # Yeild the first item we already popped
                item = first_item
                while item is not None:
                    s_type = "stdout"
                    s_content = item
                    if isinstance(item, tuple):
                         s_type, s_content = item

                    batch = pa.RecordBatch.from_pydict({
                        "stream_type": [s_type],
                        "stream_content": [s_content]
                    }, schema=log_schema)
                    yield batch
                    
                    # Fetch next
                    item = log_queue.get()
                
                # Check render errors
                t.join()
                if render_result["error"]:
                     # We can yield error as a log or raise
                     # Raising here might break the stream mid-flight, usually preferred to show error
                     error_msg = f"\n[RENDER ERROR]: {render_result['error']}"
                     yield pa.RecordBatch.from_pydict({
                        "stream_type": ["stderr"],
                        "stream_content": [error_msg]
                     }, schema=log_schema)
                     return

                # Check if there is SQL to execute
                final_sql = render_result["sql"]
                is_empty_query = not final_sql or not final_sql.strip() or all(line.strip().startswith("--") for line in final_sql.splitlines())
                
                if not is_empty_query:
                    try:
                        # Convert result to text/csv to display in terminal
                        arrow_result = context_storage.db_conn.execute(final_sql).arrow()
                        # Simple summary or CSV representation
                        summary = f"\n[SQL RESULT]: {arrow_result.num_rows} rows returned.\n"
                        # Maybe simplified display for small results?
                        if arrow_result.num_rows < 50:
                            summary += arrow_result.to_pandas().to_string()
                        else:
                            summary += "(Result too large for terminal view, run SQL separately for Grid View)"
                            
                        yield pa.RecordBatch.from_pydict({
                            "stream_type": ["system"],
                            "stream_content": [summary]
                        }, schema=log_schema)
                    except Exception as e:
                         error_msg = f"\n[SQL ERROR]: {e}"
                         yield pa.RecordBatch.from_pydict({
                            "stream_type": ["stderr"],
                            "stream_content": [error_msg]
                         }, schema=log_schema)
            
            return pa.flight.GeneratorStream(log_schema, log_generator())
        
        else:
            # OPTION 2: DATA GRID MODE (Normal)
            # No logs appeared during render (or it finished instantly empty).
            t.join()
            if render_result["error"]:
                 raise render_result["error"]
            
            final_sql = render_result["sql"]
            is_empty_query = not final_sql or not final_sql.strip() or all(line.strip().startswith("--") for line in final_sql.splitlines())
            
            if is_empty_query:
                # Just return a simple success message (single cell table)
                # But we must return a Stream.
                success_schema = pa.schema([("Result", pa.string())])
                def success_gen():
                    msg = "İşlem başarıyla tamamlandı."
                    
                    # Extract comments from final_sql if available
                    comments = []
                    if final_sql:
                         for line in final_sql.splitlines():
                             s = line.strip()
                             if s.startswith("--"):
                                 comments.append(s[2:].strip())

                    if hasattr(context_storage, "python_stdout") and context_storage.python_stdout:
                        msg = context_storage.python_stdout
                    elif comments:
                        msg = "\n".join(comments)
                        
                    yield pa.RecordBatch.from_pydict({"Result": [msg]}, schema=success_schema)
                
                return pa.flight.GeneratorStream(success_schema, success_gen())
            
            # Execute SQL and stream real results
            # Check for external connection first
            if cmd.connection_id and cmd.connection_id != "default":
                target_conn = self.connections.get(str(cmd.connection_id))
                if target_conn:
                    logger.info(f"Executing rendered query on connection {cmd.connection_id}")
                    # _execute_on_external returns a RecordBatchStream which is a FlightDataStream
                    return self._execute_on_external(target_conn, final_sql)
                else:
                    logger.warning(f"Connection ID {cmd.connection_id} not found. Falling back to default session.")

            try:
                # Use DuckDB streaming execution
                rel = context_storage.db_conn.sql(final_sql)
                
                if rel is None:
                    # DDL returned no relation
                    batch = pa.RecordBatch.from_arrays(
                         [pa.array(["İşlem başarıyla tamamlandı."])],
                         names=["Result"]
                     )
                    reader = pa.RecordBatchReader.from_batches(batch.schema, [batch])
                    return pa.flight.RecordBatchStream(reader)

                reader = rel.fetch_arrow_reader(batch_size=1024)
                return pa.flight.RecordBatchStream(reader)
                
            except Exception as e:
                logger.error(f"Error executing SQL: {e}")
                raise e
            finally:
                context_storage.log_queue = None

    def do_action(self, context, action):
        if action.type == "get_schema":
            body = json.loads(action.body.to_pybytes().decode())
            session_id = body.get("session_id", "default")
            ctx = self._get_session_context(session_id)
            
            try:
                # DuckDB uses information_schema similar to Postgres
                # Fetch tables directly from information_schema.tables to get correct types
                tables_res = ctx.execute("""
                    SELECT 
                        table_schema,
                        table_name,
                        table_type
                    FROM information_schema.tables 
                    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
                    ORDER BY table_name
                """).fetchall()
                
                tables_data = []
                for table_schema, table_name, table_type in tables_res:
                    # Fetch columns for each table/view
                    # Use parameter binding if possible, but f-string varies with execute method support.
                    # DuckDB python execute supports parameters.
                    cols_res = ctx.execute("""
                        SELECT 
                            column_name,
                            data_type
                        FROM information_schema.columns 
                        WHERE table_name = ? AND table_schema = ?
                        ORDER BY ordinal_position
                    """, [table_name, table_schema]).fetchall()
                    
                    columns = []
                    for col_name, data_type in cols_res:
                        columns.append({
                            "name": col_name,
                            "type": data_type,
                            "primaryKey": False, # Basic schema inference
                            "fk": None
                        })
                        
                    tables_data.append({
                        "name": table_name,
                        "type": table_type,
                        "columns": columns
                    })
                
                schema = {
                    "name": f"Session : {session_id}",
                    "models": [], # Models are not yet supported/implemented
                    "tables": tables_data
                }
                
                return iter([pa.flight.Result(json.dumps(schema).encode())])
            except Exception as e:
                logger.error(f"Error fetching schema: {e}")
                raise pa.flight.FlightServerError(f"Failed to fetch schema: {e}")

        elif action.type == "refresh_table":
            body = json.loads(action.body.to_pybytes().decode())
            table_name = body.get("table_name")
            session_id = body.get("session_id", "default")
            ctx = self._get_session_context(session_id)
            
            logger.info(f"Refreshing table '{table_name}' for session {session_id}")
            
            try:
                # Check if view/table exists
                ctx.execute(f"SELECT 1 FROM {table_name} LIMIT 1")
                return iter([pa.flight.Result(json.dumps({"success": True}).encode())])
            except Exception as e:
                # Table might not exist or other error
                logger.warning(f"Table refresh failed for {table_name}: {e}")
                # We return success=False but don't error out flight to avoid UI crash
                return iter([pa.flight.Result(json.dumps({"success": False, "message": str(e)}).encode())])

        elif action.type == "drop_table":
            body = json.loads(action.body.to_pybytes().decode())
            table_name = body.get("table_name")
            table_type = body.get("table_type", "").upper()
            session_id = body.get("session_id", "default")
            ctx = self._get_session_context(session_id)
            
            try:
                logger.info(f"Dropping {table_type} '{table_name}' for session {session_id}")
                safe_name = f'"{table_name}"'
                
                if table_type == 'VIEW':
                     ctx.execute(f"DROP VIEW IF EXISTS {safe_name}")
                elif table_type == 'BASE TABLE' or table_type == 'TABLE':
                     ctx.execute(f"DROP TABLE IF EXISTS {safe_name}")
                else:
                    # Fallback if unknown type (try both, but safer to respect type if possible)
                    # For safety, let's try dropping view first then table if ambiguous
                    ctx.execute(f"DROP VIEW IF EXISTS {safe_name}")
                    ctx.execute(f"DROP TABLE IF EXISTS {safe_name}")
                    
                return iter([pa.flight.Result(json.dumps({"success": True}).encode())])
            except Exception as e:
                logger.error(f"Failed to drop table {table_name}: {e}")
                raise pa.flight.FlightServerError(f"Failed to drop table: {e}")
            except Exception as e:
                logger.error(f"Table '{table_name}' could not be refreshed or found: {e}")
                raise pa.flight.FlightServerError(f"Table '{table_name}' not found or refresh failed: {e}")
        
        elif action.type == "refresh_all":
            body = json.loads(action.body.to_pybytes().decode())
            session_id = body.get("session_id", "default")
            ctx = self._get_session_context(session_id)
            #self._register_tables_in_datafusion(ctx)
            #self._register_external_conns(ctx)
            return iter([pa.flight.Result(json.dumps({"success": True}).encode())])

        elif action.type == "list_connections":
            conn_list = []
            conn = sqlite3.connect(self.db_path)
            cursor = conn.execute("SELECT id, name, type, connection_string FROM _meta_connections")
            for row in cursor.fetchall():
                cid, name, ctype, cstr = row
                conn_list.append({
                    "id": str(cid),
                    "name": name,
                    "type": ctype,
                    "connection_string": cstr # In production, mask this!
                })
            
            conn.close()
            return iter([pa.flight.Result(json.dumps(conn_list).encode())])

        elif action.type == "save_connection":
            body = json.loads(action.body.to_pybytes().decode())
            name = body.get("name")
            ctype = body.get("type")
            cstr = body.get("connection_string")
            
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO _meta_connections (name, type, connection_string) VALUES (?, ?, ?)",
                    (name, ctype, cstr)
                )
                new_id = cursor.lastrowid
                conn.commit()
                conn.close()
                
                # Update memory
                self.connections[str(new_id)] = cstr
                self.connection_map[name] = cstr
                
                return iter([pa.flight.Result(json.dumps({"success": True, "id": str(new_id)}).encode())])
            except sqlite3.IntegrityError:
                 raise pa.flight.FlightServerError(f"Connection with name '{name}' already exists.")
            except Exception as e:
                raise pa.flight.FlightServerError(f"Failed to save connection: {e}")

        elif action.type == "delete_connection":
            body = json.loads(action.body.to_pybytes().decode())
            conn_id = str(body.get("id"))
            
            if conn_id.startswith("sys_"):
                 raise pa.flight.FlightServerError("Cannot delete system connections.")

            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Get name first to update map
                cursor.execute("SELECT name FROM _meta_connections WHERE id = ?", (conn_id,))
                row = cursor.fetchone()
                if not row:
                     conn.close()
                     raise pa.flight.FlightServerError(f"Connection ID {conn_id} not found.")
                
                name = row[0]
                
                cursor.execute("DELETE FROM _meta_connections WHERE id = ?", (conn_id,))
                conn.commit()
                conn.close()
                
                # Update memory
                if conn_id in self.connections:
                    del self.connections[conn_id]
                if name in self.connection_map:
                    del self.connection_map[name]
                
                return iter([pa.flight.Result(json.dumps({"success": True}).encode())])
            except Exception as e:
                raise pa.flight.FlightServerError(f"Failed to delete connection: {e}")

        elif action.type == "create_session":
            # Generate readable unique session ID
            # Format: Session_HHMMSS_{rnd}
            import random
            import string
            
            while True:
                now_str = datetime.now().strftime("%H%M%S")
                rnd = ''.join(random.choices(string.ascii_uppercase, k=3))
                new_session_id = f"Session_{now_str}_{rnd}"
                
                if new_session_id not in self._sessions:
                    break
            
            # Pre-initialize session (optional but ensures it is ready)
            self._get_session_context(new_session_id)
            
            return iter([pa.flight.Result(json.dumps({"success": True, "session_id": new_session_id}).encode())])

        raise pa.flight.FlightServerError(f"Unknown action: {action.type}")
