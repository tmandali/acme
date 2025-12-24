import asyncio
import sqlite3
from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.worker import Worker
from datetime import timedelta

# Initialize a simple in-memory SQLite database with sample data
def init_db():
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    
    # 1. ACCOUNTS
    cursor.execute("""
        CREATE TABLE ACCOUNTS (
            ID INTEGER PRIMARY KEY, EMAIL TEXT, FIRST_NAME TEXT, LAST_NAME TEXT, 
            PLAN TEXT, SOURCE TEXT, SEATS INTEGER, CREATED_AT TEXT, ACTIVE_SUBSCRIPTION BOOLEAN
        )
    """)
    
    # 2. PEOPLE
    cursor.execute("CREATE TABLE PEOPLE (ID INTEGER PRIMARY KEY, NAME TEXT, EMAIL TEXT, CITY TEXT, CREATED_AT TEXT)")
    
    # 3. PRODUCTS
    cursor.execute("CREATE TABLE PRODUCTS (ID INTEGER PRIMARY KEY, NAME TEXT, CATEGORY TEXT, PRICE DECIMAL, VENDOR TEXT)")
    
    # 4. ORDERS
    cursor.execute("CREATE TABLE ORDERS (ID INTEGER PRIMARY KEY, USER_ID INTEGER, PRODUCT_ID INTEGER, QUANTITY INTEGER, TOTAL DECIMAL, CREATED_AT TEXT)")

    # Insert Sample Data for ACCOUNTS
    sources = ["Facebook", "Twitter", "Google", "LinkedIn", "Instagram", "Direct"]
    plans = ["Basic", "Pro", "Enterprise", "Starter"]
    first_names = ["Macy", "Kim", "Princess", "Jeramie", "Clay", "Magnus", "Mekhi", "Sarah", "John", "Emma"]
    last_names = ["Kub", "Cormier", "Tillman", "Pfannerstill", "Johnston", "Carroll", "O'Conner", "Smith", "Johnson", "Williams"]
    
    for i in range(50):
        fn = first_names[i % len(first_names)]
        ln = last_names[i % len(last_names)]
        cursor.execute("INSERT INTO ACCOUNTS VALUES (?,?,?,?,?,?,?,?,?)", (
            i + 1, f"{fn.lower()}.{ln.lower()}{i}@example.com", fn, ln,
            plans[i % len(plans)], sources[i % len(sources)], (i * 7) % 50 + 1,
            f"2020-09-{str((i % 28) + 1).zfill(2)}", i % 3 != 0
        ))

    # Insert Sample Data for PEOPLE (Users)
    for i in range(20):
        cursor.execute("INSERT INTO PEOPLE VALUES (?,?,?,?,?)", (
            i + 1, f"{first_names[i%10]} {last_names[i%10]}", f"user{i}@acme.com", "Istanbul", "2023-01-01"
        ))
    
    # Create an alias for PEOPLE as 'users' since it's common
    cursor.execute("CREATE VIEW users AS SELECT * FROM PEOPLE")
    
    conn.commit()
    return conn

# Shared DB connection for the demo
db_conn = init_db()

# Activities
@activity.defn
async def execute_sql_activity(query: str) -> list:
    print(f"\n>>> [Worker] Executed SQL: {query}")
    try:
        # SQLite doesn't support schema prefixes like 'public.'
        # Let's clean up common PostgreSQL syntax for the mock DB
        cleaned_query = query.replace("public.", "").replace("PUBLIC.", "")
        
        cursor = db_conn.cursor()
        cursor.execute(cleaned_query)
        
        # Get column names
        columns = [column[0] for column in cursor.description]
        
        # Fetch results
        rows = cursor.fetchall()
        
        # Map to list of dicts
        data = [dict(zip(columns, row)) for row in rows]
        
        print(f">>> [Worker] Query successful. Returning {len(data)} rows")
        return data
    except Exception as e:
        print(f">>> [Worker] Query Error: {str(e)}")
        return [{"ERROR": str(e)}]

# Workflows
@workflow.defn
class ExecuteSQLWorkflow:
    @workflow.run
    async def run(self, query: str) -> list:
        print(f">>> [Workflow] Starting execution for query: {query[:50]}...")
        result = await workflow.execute_activity(
            execute_sql_activity,
            query,
            start_to_close_timeout=timedelta(seconds=30),
        )
        print(f">>> [Workflow] Finished.")
        return result

async def main():
    # Connect to Temporal
    try:
        client = await Client.connect("localhost:7233")
    except Exception as e:
        print(f"Failed to connect to Temporal: {e}")
        return

    worker = Worker(
        client,
        task_queue="sql-tasks-v2",
        workflows=[ExecuteSQLWorkflow],
        activities=[execute_sql_activity],
    )
    print("Worker (v2) started. Waiting for tasks on 'sql-tasks-v2'...")
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
