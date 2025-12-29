import json
import sqlite3
import pathlib
import yaml
from datetime import datetime
from dataclasses import asdict
import pyarrow as pa
import pyarrow.flight
from jinja2 import Environment, FileSystemLoader
from faker import Faker
import logging
import datafusion

from .models import QueryCommand, SqlWrapper, TemplateMetadata
from .filters import (
    filter_quote, filter_sql, filter_between, filter_eq, filter_add_days,
    filter_gt, filter_lt, filter_gte, filter_lte, filter_ne, filter_like,
    filter_start, filter_end
)
from .types import sqlite_to_arrow_type

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("StreamFlightServer")

class StreamFlightServer(pa.flight.FlightServerBase):
    def __init__(self, location="grpc://0.0.0.0:8815", query_dirs=None, db_path="data.db", **kwargs):
        super(StreamFlightServer, self).__init__(location, **kwargs)
        self.location = location
        self.query_dirs = query_dirs or [
            pathlib.Path("./templates"),
            pathlib.Path("../app/sql-query/query")
        ]
        self.db_path = db_path
        self._template_cache = {} # Basit önbellek
        
        # Setup Jinja
        self.jinja_env = Environment(loader=FileSystemLoader([str(d) for d in self.query_dirs]))
        self.jinja_env.filters["quote"] = filter_quote
        self.jinja_env.filters["sql"] = filter_sql
        self.jinja_env.filters["between"] = filter_between
        self.jinja_env.filters["eq"] = filter_eq
        self.jinja_env.filters["add_days"] = filter_add_days
        self.jinja_env.filters["gt"] = filter_gt
        self.jinja_env.filters["lt"] = filter_lt
        self.jinja_env.filters["gte"] = filter_gte
        self.jinja_env.filters["ge"] = filter_gte  # Alias
        self.jinja_env.filters["lte"] = filter_lte
        self.jinja_env.filters["le"] = filter_lte  # Alias
        self.jinja_env.filters["ne"] = filter_ne
        self.jinja_env.filters["like"] = filter_like
        self.jinja_env.filters["start"] = filter_start
        self.jinja_env.filters["begin"] = filter_start  # Alias
        self.jinja_env.filters["end"] = filter_end
        self.jinja_env.filters["finish"] = filter_end   # Alias
        
        self.jinja_env.globals["now"] = datetime.now().strftime("%Y%m%d")
        self.jinja_env.globals["zip"] = zip
        
        # Initialize DataFusion Context with Information Schema enabled
        config = datafusion.SessionConfig().with_information_schema(True)
        self.ctx = datafusion.SessionContext(config)
        
        self._init_db()
        self._register_tables_in_datafusion()

    def _init_db(self):
        logger.info(f"Initializing database at {self.db_path}")
        conn = sqlite3.connect(self.db_path)
        fake = Faker()
        
        # Check if we need to regenerate
        regenerate = False
        try:
            # Check for new schema presence
            cursor = conn.execute("PRAGMA table_info(ACCOUNTS)")
            cols = [info[1] for info in cursor.fetchall()]
            count = conn.execute("SELECT COUNT(*) FROM ACCOUNTS").fetchone()[0]
            
            if 'EMAIL' not in cols or count < 50000:
                regenerate = True
        except:
            regenerate = True

        if regenerate:
             logger.info("Regenerating database with realistic data...")
             conn.execute("DROP TABLE IF EXISTS ACCOUNTS")
             conn.execute("DROP TABLE IF EXISTS TRANSACTIONS")
             conn.execute("DROP TABLE IF EXISTS sales_invoices") 

             conn.execute("CREATE TABLE ACCOUNTS (ID INTEGER PRIMARY KEY, NAME TEXT, EMAIL TEXT, ADDRESS TEXT, STATE TEXT, CREATED_AT TEXT)")
             conn.execute("CREATE TABLE TRANSACTIONS (ID INTEGER PRIMARY KEY, ACCOUNT_ID INTEGER, AMOUNT REAL, CURRENCY TEXT, DESCRIPTION TEXT, DATE TEXT)")
             
             logger.info("Generating 50,000 accounts...")
             accounts = []
             for i in range(1, 50001):
                 accounts.append((
                     i, 
                     fake.name(), 
                     fake.email(), 
                     fake.address().replace('\n', ', '), 
                     fake.state_abbr(),
                     fake.date_between(start_date='-2y', end_date='today').strftime('%Y%m%d')
                 ))
                 
                 if len(accounts) >= 5000:
                     conn.executemany("INSERT INTO ACCOUNTS VALUES (?, ?, ?, ?, ?, ?)", accounts)
                     accounts = []
            
             if accounts:
                 conn.executemany("INSERT INTO ACCOUNTS VALUES (?, ?, ?, ?, ?, ?)", accounts)
             
             # Generate Transactions
             logger.info("Generating transactions...")
             txn_batch = []
             txn_id = 1
             for acc_id in range(1, 50001):
                  # Generate 0-3 transactions per account
                  for _ in range(fake.random_int(min=0, max=3)):
                      txn_batch.append((
                          txn_id,
                          acc_id,
                          round(fake.random.uniform(10.0, 5000.0), 2),
                          fake.currency_code(),
                          fake.bs(),
                          fake.date_between(start_date='-1y', end_date='today').strftime('%Y%m%d')
                      ))
                      txn_id += 1
                  
                  if len(txn_batch) >= 5000:
                       conn.executemany("INSERT INTO TRANSACTIONS VALUES (?, ?, ?, ?, ?, ?)", txn_batch)
                       txn_batch = []
             
             if txn_batch:
                 conn.executemany("INSERT INTO TRANSACTIONS VALUES (?, ?, ?, ?, ?, ?)", txn_batch)

             conn.commit()
             logger.info("Database generation complete.")
        
        conn.close()

    def _register_tables_in_datafusion(self):
        """
        Registers all tables from SQLite into DataFusion as Arrow tables.
        This follows the user's request to use RecordBatchReader for registration.
        """
        logger.info("Registering SQLite tables in DataFusion context...")
        conn = sqlite3.connect(self.db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        conn.close()

        for table_name in tables:
            try:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.execute(f"SELECT * FROM {table_name}")
                col_names = [col[0] for col in cursor.description]
                rows = cursor.fetchall()
                conn.close()

                if not rows:
                    continue

                # Convert to Arrow Batch
                # Normalize column names to lowercase for easier SQL querying without quotes
                cols = list(zip(*rows))
                batch = pa.RecordBatch.from_arrays(
                    [pa.array(c) for c in cols],
                    names=[n.lower() for n in col_names]
                )
                
                # Register in DataFusion
                self.ctx.register_record_batches(table_name, [[batch]])
                logger.info(f"Table '{table_name}' registered in DataFusion.")
            except Exception as e:
                logger.error(f"Failed to register table {table_name}: {e}")

    def list_flights(self, context, criteria):
        """
        Mevcut sorgu şablonlarını listeler.
        """
        seen_templates = set()
        
        for query_dir in self.query_dirs:
            if not query_dir.exists():
                continue
                
            for path in query_dir.glob("*.yaml"):
                if path.name in seen_templates: continue
                
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        config = yaml.safe_load(f)
                    
                    meta = TemplateMetadata.from_dict(path.name, config)
                    seen_templates.add(path.name)
                    
                    descriptor_data = {"template": meta.name, "metadata": asdict(meta)}
                    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(descriptor_data).encode('utf-8'))
                    
                    yield pa.flight.FlightInfo(
                        pa.schema([]), descriptor, 
                        [pa.flight.FlightEndpoint(descriptor.command, [self.location])], 
                        -1, -1
                    )
                except Exception as e:
                    logger.warning(f"Failed to load template {path}: {e}")
                    continue

    def _render_query(self, cmd: QueryCommand):
        criteria = {k: SqlWrapper(v, k, jinja_env=self.jinja_env) for k, v in cmd.criteria.items()}
        
        # Ad-hoc SQL execution (via cmd.query)
        if cmd.query:
            try:
                template = self.jinja_env.from_string(cmd.query)
                sql = template.render(**criteria)
                logger.debug(f"Rendered Ad-hoc SQL:\n{sql}")
                return sql
            except Exception as e:
                logger.exception("Error rendering ad-hoc SQL")
                raise

        # File-based Execution (via cmd.template)
        yaml_path = None
        for d in self.query_dirs:
            p = d / cmd.template
            if p.exists():
                yaml_path = p
                break
        
        if not yaml_path:
            logger.error(f"Template not found: {cmd.template}")
            raise FileNotFoundError(f"YAML query file not found: {cmd.template}")

        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                sql_template_str = config.get('sql', '')
                template = self.jinja_env.from_string(sql_template_str)
            
            sql = template.render(**criteria)
            logger.debug(f"Rendered SQL for {cmd.template}:\n{sql}")
            return sql
        except Exception as e:
            logger.exception(f"Error rendering template {cmd.template}")
            raise

    def get_flight_info(self, context, descriptor):
        cmd = QueryCommand.from_json(descriptor.command.decode('utf-8'))
        sql = self._render_query(cmd)
        
        # Use DataFusion to infer schema
        try:
            df = self.ctx.sql(sql)
            schema = df.schema()
            logger.info(f"Flight info metadata generated for {cmd.template} via DataFusion")
        except Exception as e:
            logger.error(f"DataFusion SQL Pre-execution failed. SQL was:\n{sql}")
            raise pa.flight.FlightServerError(f"DataFusion SQL Error: {e}")

        ticket = pa.flight.Ticket(descriptor.command)
        endpoints = [pa.flight.FlightEndpoint(ticket, [self.location])]
        return pa.flight.FlightInfo(schema, descriptor, endpoints, -1, -1)

    def do_get(self, context, ticket):
        try:
            cmd = QueryCommand.from_json(ticket.ticket.decode('utf-8'))
            sql = self._render_query(cmd)
            logger.info(f"Executing query for {cmd.template} via DataFusion")

            # Execute via DataFusion
            df = self.ctx.sql(sql)
            
            # Use collect() to get batches
            batches = df.collect()
            
            # Create a reader from the batches
            schema = df.schema()
            reader = pa.RecordBatchReader.from_batches(schema, batches)
            
            return pa.flight.RecordBatchStream(reader)
        except Exception as e:
            logger.exception("Error in do_get via DataFusion")
            raise
