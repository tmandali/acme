import pathlib
from query_engine import StreamFlightServer

if __name__ == '__main__':
    base_dir = pathlib.Path(__file__).parent
    query_dirs = [
        base_dir / "templates",
        base_dir.parent / "frontend/app/sql-query/query"
    ]
    
    server = StreamFlightServer(location="grpc://0.0.0.0:8815", query_dirs=query_dirs, db_path=str(base_dir / "data.db"))
    print(f"StreamFlightServer listening on {server.location}")
    server.serve()
