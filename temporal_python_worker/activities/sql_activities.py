import sqlite3
import pandas as pd
import pyarrow as pa
from temporalio import activity

# In-memory DB shared for the demo (normally this would be a real DB connection)
def get_db():
    # In a real app, this might be a persistent DB
    conn = sqlite3.connect(":memory:")
    # ... (we'd need to re-init it or use a shared one in the worker)
    # For now, let's assume the worker handles the init and we just use it.
    return conn

# We'll pass the connection or use a global one in the worker
_db_conn = None

def set_db_conn(conn):
    global _db_conn
    _db_conn = conn

@activity.defn
async def execute_sql_activity(query: str) -> bytes:
    print(f"\n>>> [Worker] Executed SQL: {query}")
    if _db_conn is None:
        raise RuntimeError("Database connection not initialized in activity")
        
    try:
        cleaned_query = query.replace("public.", "").replace("PUBLIC.", "")
        
        cursor = _db_conn.cursor()
        cursor.execute(cleaned_query)
        
        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()
        
        df = pd.DataFrame(rows, columns=columns)
        table = pa.Table.from_pandas(df)
        
        sink = pa.BufferOutputStream()
        with pa.ipc.new_stream(sink, table.schema) as writer:
            writer.write_table(table)
            
        result_bytes = sink.getvalue().to_pybytes()
        
        print(f">>> [Worker] Query successful. Returning {len(df)} rows as Arrow IPC ({len(result_bytes)} bytes)")
        return result_bytes
    except Exception as e:
        print(f">>> [Worker] Query Error: {str(e)}")
        raise e
