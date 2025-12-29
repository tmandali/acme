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
from .jinja_extensions import ReaderExtension
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
            pathlib.Path("./templates"),
            pathlib.Path("../app/sql-query/query")
        ]
        
        # 1. Initialize Sessions
        self._sessions = {}
        self._max_sessions = 100
        
        # 2. Setup Template Engine (Jinja)
        self._setup_jinja()
        
        # 3. Initialize Shared Database (SQLite)
        self._init_db()

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
        self._register_tables_in_datafusion(ctx)
        self._register_external_conns(ctx)
        
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

    def _init_db(self):
        """Ensures the SQLite database exists and has seed data."""
        logger.info(f"Initializing database at {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        fake = Faker()
        
        # Check if regeneration is needed
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM ACCOUNTS")
            count = cursor.fetchone()[0]
            if count >= 50000:
                conn.close()
                return
        except Exception:
            pass

        logger.info("Generating seed data...")
        conn.executescript("""
            DROP TABLE IF EXISTS ACCOUNTS;
            DROP TABLE IF EXISTS TRANSACTIONS;
            CREATE TABLE ACCOUNTS (ID INTEGER PRIMARY KEY, NAME TEXT, EMAIL TEXT, ADDRESS TEXT, STATE TEXT, CREATED_AT TEXT);
            CREATE TABLE TRANSACTIONS (ID INTEGER PRIMARY KEY, ACCOUNT_ID INTEGER, AMOUNT REAL, CURRENCY TEXT, DESCRIPTION TEXT, DATE TEXT);
        """)

        # Accounts
        accs = [(i, fake.name(), fake.email(), fake.address().replace('\n', ', '), fake.state_abbr(), 
                 fake.date_between(start_date='-2y', end_date='today').strftime('%Y%m%d')) for i in range(1, 50001)]
        conn.executemany("INSERT INTO ACCOUNTS VALUES (?,?,?,?,?,?)", accs)

        # Transactions
        txns = []
        for acc_id in range(1, 50001):
            for _ in range(fake.random_int(0, 3)):
                txns.append((None, acc_id, round(fake.random.uniform(10, 5000), 2), fake.currency_code(), fake.bs(),
                             fake.date_between(start_date='-1y', end_date='today').strftime('%Y%m%d')))
        conn.executemany("INSERT INTO TRANSACTIONS VALUES (?,?,?,?,?,?)", txns)
        
        conn.commit()
        conn.close()
        conn.close()

    def _register_tables_in_datafusion(self, ctx: datafusion.SessionContext, target_table_name: str = None):
        """Pre-registers SQLite tables in a specific context for visibility."""
        logger.info(f"Registering SQLite tables in session...")
        conn = sqlite3.connect(self.db_path)
        if target_table_name:
            # Check if this table exists in SQLite
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND LOWER(name) = LOWER(?)", (target_table_name,))
            tables = [r[0] for r in cursor.fetchall()]
        else:
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r[0] for r in cursor.fetchall()]
        
        for table_name in tables:
            try:
                cursor = conn.execute(f"SELECT * FROM {table_name}")
                col_names = [col[0] for col in cursor.description]
                normalized_names = [n.lower() for n in col_names]
                
                batches = []
                while True:
                    rows = cursor.fetchmany(1000)
                    if not rows: break
                    
                    cols = list(zip(*rows))
                    batches.append(pa.RecordBatch.from_arrays(
                        [pa.array(c) for c in cols],
                        names=normalized_names
                    ))
                
                if batches:
                    ctx.register_record_batches(table_name.lower(), [batches])
                    logger.info(f"Pre-registered local table '{table_name.lower()}'")
            except Exception as e:
                logger.warning(f"Failed to pre-register {table_name}: {e}")
        
        conn.close()

    def _register_external_conns(self, ctx: datafusion.SessionContext, target_table_name: str = None):
        """Discovers and registers tables from external connections (e.g. MSSQL)."""
        if not self.external_conns:
            return

        for conn_str in self.external_conns:
            try:
                if conn_str.startswith("mssql://"):
                    logger.info(f"Discovering tables from MSSQL: {conn_str[:20]}...")
                    # Temporarily use ReaderExtension's connection logic
                    from .jinja_extensions import ReaderExtension
                    ext = ReaderExtension(self.jinja_env)
                    conn = ext._connect_mssql(conn_str)
                    cursor = conn.cursor()
                    if target_table_name:
                        # Find the correct casing in MSSQL for the requested table name
                        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND LOWER(TABLE_NAME) = LOWER(%s)", (target_table_name,))
                        tables = [r[0] for r in cursor.fetchall()]
                        if not tables:
                            logger.info(f"Table '{target_table_name}' not found in external connection {conn_str[:20]}")
                            conn.close()
                            continue
                    else:
                        # Discover user tables in MSSQL
                        cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
                        tables = [r[0] for r in cursor.fetchall()]
                    
                    for table_name in tables:
                        try:
                            # Fetch all data in batches (consistent with ReaderExtension)
                            cursor.execute(f"SELECT * FROM {table_name}")
                            col_names = [col[0] for col in cursor.description]
                            normalized_names = [n.lower() for n in col_names]
                            
                            batches = []
                            while True:
                                rows = cursor.fetchmany(1000)
                                if not rows:
                                    break
                                
                                cols = list(zip(*rows))
                                batches.append(pa.RecordBatch.from_arrays(
                                    [pa.array(c) for c in cols],
                                    names=normalized_names
                                ))
                            
                            if batches:
                                ctx.register_record_batches(table_name.lower(), [batches])
                                logger.info(f"Pre-registered remote MSSQL table '{table_name.lower()}'")
                            else:
                                # Empty table schema
                                fields = [pa.field(n, pa.string()) for n in normalized_names]
                                schema = pa.schema(fields)
                                empty_batch = pa.RecordBatch.from_arrays([pa.array([], type=pa.string()) for _ in normalized_names], schema=schema)
                                ctx.register_record_batches(table_name.lower(), [[empty_batch]])
                        except Exception as inner_e:
                            logger.warning(f"Failed to register remote table {table_name}: {inner_e}")
                    conn.close()
            except Exception as e:
                logger.error(f"Failed to connect to external source: {e}")

    def _render_query(self, cmd: QueryCommand, ctx: datafusion.SessionContext) -> str:
        """Processes Jinja templates into SQL strings using specific session context."""
        # ReaderExtension uses self.environment.globals["datafusion_ctx"]
        # In a multi-session environment, we set it just before render.
        # Note: Since Flight is multi-threaded, we MUST use a thread-local or environment per request.
        # But we can also just pass it to context and make ReaderExtension fetch it from there.
        self.jinja_env.globals["datafusion_ctx"] = ctx
        
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
        ctx = self._get_session_context(cmd.session_id)
        sql = self._render_query(cmd, ctx)
        try:
            df = ctx.sql(sql)
            return pa.flight.FlightInfo(df.schema(), descriptor, [pa.flight.FlightEndpoint(pa.flight.Ticket(descriptor.command), [self.location])], -1, -1)
        except Exception as e:
            logger.error(f"Schema inference failed for session {cmd.session_id}. SQL:\n{sql}")
            raise pa.flight.FlightServerError(f"DataFusion Error: {e}")

    def do_get(self, context, ticket):
        try:
            cmd = QueryCommand.from_json(ticket.ticket.decode())
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
            raise

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

        raise pa.flight.FlightServerError(f"Unknown action: {action.type}")
