import duckdb
import pyarrow as pa
import logging

def test_duckdb_persistence():
    ctx = duckdb.connect(":memory:")
    
    # Create Arrow Table
    data = [pa.array([1, 2, 3]), pa.array(["a", "b", "c"])]
    batch = pa.RecordBatch.from_arrays(data, names=["id", "val"])
    table = pa.Table.from_batches([batch])
    
    # Register
    print("Registering table 'test'...")
    ctx.register("test", table)
    
    # Check immediate existence
    print("Checking immediate existence...")
    rel = ctx.sql("select * from test")
    print(rel.fetchall())
    
    # Simulate function exit (scope change)
    del table
    del batch
    del data
    
    # Check persistence
    print("Checking persistence...")
    try:
        rel = ctx.sql("select * from test")
        print(rel.fetchall())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_duckdb_persistence()
