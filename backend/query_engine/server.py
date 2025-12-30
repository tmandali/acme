import json
import sqlite3
import pathlib
import yaml
import logging
import datafusion
import pyarrow as pa
import pyarrow.flight
from datetime import datetime
from dataclasses import asdict
from jinja2 import Environment, FileSystemLoader
from faker import Faker

from .models import QueryCommand, SqlWrapper, TemplateMetadata
from .jinja_extensions import ReaderExtension, context_storage
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
        
        # Initialize connections map
        # Initialize connections map
        self.connections = {}
        self.connection_map = {}
        if isinstance(self.external_conns, list):
            for i, conn in enumerate(self.external_conns):
                # Use a prefix to avoid collision with database IDs
                cid = f"sys_{i+1}"
                name = f"System Connection {i+1}"
                self.connections[cid] = conn
                self.connection_map[name] = conn
        elif isinstance(self.external_conns, dict):
            self.connections = self.external_conns
            # Assume keys are names in dict mode, but complex to map ID. 
            # Simplified: just use dict as connections map too if needed.
            self.connection_map = self.external_conns.copy()

        # 1. Initialize Sessions
        self._sessions = {}
        self._max_sessions = 100
        
        # 2. Setup Template Engine (Jinja)
        self._setup_jinja()
        
        # 3. Initialize Shared Database (SQLite) and Metadata
        self._init_metadata_db()
        self._load_connections()

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
            
            # Direct connection execution
            if cmd.connection_id and cmd.connection_id != "default":
                target_conn = self.connections.get(str(cmd.connection_id))
                if target_conn:
                    logger.info(f"Executing direct query on connection {cmd.connection_id}")
                    return self._execute_on_external(target_conn, cmd.query)
                else:
                    logger.warning(f"Connection ID {cmd.connection_id} not found. Falling back to default.")

            ctx = self._get_session_context(cmd.session_id)
            sql = self._render_query(cmd, ctx)
            df = ctx.sql(sql)
            
            # Low-memory streaming using a generator
            stream = df.execute_stream()
            def batch_gen():
                for b in stream:
                    yield b.to_pyarrow()
            
            return pa.flight.RecordBatchStream(pa.RecordBatchReader.from_batches(df.schema(), batch_gen()))
        except Exception as e:
            logger.exception("Query execution failed")
            # Clean up error message for display
            msg = str(e)
            
            # Remove DataFusion specific prefixes
            if "DataFusion error: Execution" in msg:
                # Extract the inner message: Execution("...")
                import re
                match = re.search(r'Execution\("(.*?)"\)', msg)
                if match:
                    msg = match.group(1)
                else:
                    msg = msg.split("Execution(")[-1].rstrip(")")
            
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
                    port=u.port or 1433
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

    def _get_session_context(self, session_id: str) -> datafusion.SessionContext:
        """Returns existing or creates a new isolated SessionContext for the user."""
        if session_id in self._sessions:
            return self._sessions[session_id]

        # Cleanup if too many sessions
        if len(self._sessions) >= self._max_sessions:
            oldest = next(iter(self._sessions))
            del self._sessions[oldest]

        logger.info(f"Creating new session context for: {session_id}")
        config = datafusion.SessionConfig().with_information_schema(True)
        ctx = datafusion.SessionContext(config)
        
        # Register default tables for this new session
        #self._register_tables_in_datafusion(ctx)
        #self._register_external_conns(ctx)
        
        self._sessions[session_id] = ctx
        return ctx

    def _setup_jinja(self):
        self.jinja_env = Environment(
            loader=FileSystemLoader([str(d) for d in self.query_dirs]),
            extensions=[ReaderExtension]
        )
        # Shared utilities
        self.jinja_env.globals["now"] = datetime.now().strftime("%Y%m%d")
        self.jinja_env.globals["zip"] = zip
        
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

    # def _register_tables_in_datafusion(self, ctx: datafusion.SessionContext, target_table_name: str = None):
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
                
    #             batches = []
    #             while True:
    #                 rows = cursor.fetchmany(1000)
    #                 if not rows: break
                    
    #                 cols = list(zip(*rows))
    #                 batches.append(pa.RecordBatch.from_arrays(
    #                     [pa.array(c) for c in cols],
    #                     names=normalized_names
    #                 ))
                
    #             if batches:
    #                 ctx.register_record_batches(table_name.lower(), [batches])
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

    def _render_query(self, cmd: QueryCommand, ctx: datafusion.SessionContext) -> str:
        """Processes Jinja templates into SQL strings using specific session context."""
        # Use thread-local storage accessable by ReaderExtension
        # This prevents race conditions in multi-threaded environment where
        # global environment variables would be overwritten.
        context_storage.datafusion_ctx = ctx
        context_storage.connection_map = self.connection_map
        
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
            # But avoiding 'DataFusion Error' is the priority.
            if self.connections.get(str(cmd.connection_id)):
                return pa.flight.FlightInfo(
                    pa.schema([]), # Empty schema/unknown
                    descriptor, 
                    [pa.flight.FlightEndpoint(pa.flight.Ticket(descriptor.command), [self.location])], 
                    -1, 
                    -1
                )
        
        ctx = self._get_session_context(cmd.session_id)
        sql = self._render_query(cmd, ctx)
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
                    [pa.flight.FlightEndpoint(pa.flight.Ticket(descriptor.command), [self.location])], 
                    -1, 
                    -1
                )

            # Plan the query to check for DDL/DML via Logical Plan (fallback for complex cases)
            logical_plan = ctx.sql(sql).logical_plan()
            
            # Check for non-SELECT statements by inspecting the logical plan string representation
            # DataFusion's logical plan for DDL/DML usually starts with specific keywords
            plan_str = str(logical_plan).strip().upper()
            is_modification = (
                "DmlStatement" in str(logical_plan) or 
                "CreateMemoryTable" in str(logical_plan)
            )

            if is_modification:
                logger.info(f"Skipping schema inference for modification query: {sql[:50]}...")
                return pa.flight.FlightInfo(
                    pa.schema([("result", pa.string())]), 
                    descriptor, 
                    [pa.flight.FlightEndpoint(pa.flight.Ticket(descriptor.command), [self.location])], 
                    -1, 
                    -1
                )

            df = ctx.sql(sql)
            return pa.flight.FlightInfo(df.schema(), descriptor, [pa.flight.FlightEndpoint(pa.flight.Ticket(descriptor.command), [self.location])], -1, -1)
        except Exception as e:
            logger.error(f"Schema inference failed for session {cmd.session_id}. SQL:\n{sql}")
            # If planning fails (e.g. table doesn't exist yet but will be created), 
            # we might want to let it fail in do_get, but for now reporting error is safer.
            raise pa.flight.FlightServerError(f"DataFusion Error: {e}")



    def do_action(self, context, action):
        if action.type == "refresh_table":
            body = json.loads(action.body.to_pybytes().decode())
            table_name = body.get("table_name")
            session_id = body.get("session_id", "default")
            ctx = self._get_session_context(session_id)
            
            logger.info(f"Manually refreshing table '{table_name}' for session {session_id}")
            
            # Count how many tables were actually refreshed
            # We'll check the logs or just assume if it doesn't crash it might have worked.
            # But better: check if it exists in either one.
            
            self._register_tables_in_datafusion(ctx, target_table_name=table_name)
            self._register_external_conns(ctx, target_table_name=table_name)
            
            # Check if DataFusion now has the table (it should if registered)
            try:
                ctx.sql(f"SELECT 1 FROM {table_name} LIMIT 1")
                return iter([pa.flight.Result(json.dumps({"success": True}).encode())])
            except Exception as e:
                logger.error(f"Table '{table_name}' could not be refreshed or found: {e}")
                raise pa.flight.FlightServerError(f"Table '{table_name}' not found or refresh failed: {e}")
        
        elif action.type == "refresh_all":
            body = json.loads(action.body.to_pybytes().decode())
            session_id = body.get("session_id", "default")
            ctx = self._get_session_context(session_id)
            self._register_tables_in_datafusion(ctx)
            self._register_external_conns(ctx)
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
            
            # Also add external_conns from init (marked as system/config)
            if isinstance(self.external_conns, list):
                for i, cstr in enumerate(self.external_conns):
                     conn_list.append({
                        "id": f"sys_{i+1}", 
                        "name": f"System Connection {i+1}",
                        "type": "system",
                        "connection_string": cstr
                    })
            elif isinstance(self.external_conns, dict):
                for name, cstr in self.external_conns.items():
                     conn_list.append({
                        "id": name,
                        "name": name, 
                        "type": "system",
                        "connection_string": cstr
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

        raise pa.flight.FlightServerError(f"Unknown action: {action.type}")
