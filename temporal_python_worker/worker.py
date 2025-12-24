import asyncio
import sqlite3
from temporalio.client import Client
from temporalio.worker import Worker

# Import our activities and workflows
from activities.sql_activities import execute_sql_activity, set_db_conn
from workflows.sql_workflow import ExecuteSQLWorkflow

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

    # Insert Sample Data
    first_names = ["Macy", "Kim", "Princess", "Jeramie", "Clay", "Magnus", "Mekhi", "Sarah", "John", "Emma"]
    last_names = ["Kub", "Cormier", "Tillman", "Pfannerstill", "Johnston", "Carroll", "O'Conner", "Smith", "Johnson", "Williams"]
    
    for i in range(50):
        fn = first_names[i % len(first_names)]
        ln = last_names[i % len(last_names)]
        cursor.execute("INSERT INTO ACCOUNTS VALUES (?,?,?,?,?,?,?,?,?)", (
            i + 1, f"{fn.lower()}.{ln.lower()}{i}@example.com", fn, ln,
            "Pro" if i % 2 == 0 else "Basic", "Twitter" if i % 3 == 0 else "Direct", (i * 7) % 50 + 1,
            f"2020-09-{str((i % 28) + 1).zfill(2)}", i % 3 != 0
        ))

    for i in range(20):
        cursor.execute("INSERT INTO PEOPLE VALUES (?,?,?,?,?)", (
            i + 1, f"{first_names[i%10]} {last_names[i%10]}", f"user{i}@acme.com", "Istanbul", "2023-01-01"
        ))
    
    cursor.execute("CREATE VIEW users AS SELECT * FROM PEOPLE")
    conn.commit()
    return conn

async def main():
    # Initialize DB and share it with activities
    db_conn = init_db()
    set_db_conn(db_conn)

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
        # Optionally disable sandbox if imports still fail, but moving to files usually fixes it
        # workflow_runner=UnsandboxedWorkflowRunner(), 
    )
    print("Worker started. Registered ExecuteSQLWorkflow and execute_sql_activity.")
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
