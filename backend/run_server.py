import pathlib
from query_engine import StreamFlightServer

if __name__ == '__main__':
    base_dir = pathlib.Path(__file__).parent
    query_dirs = [
        base_dir / "templates",
        base_dir.parent / "frontend/app/sql-query/query"
    ]
    
    external_conns = [
        "mssql://sa:Passw%40rd@localhost:1433/testDb?encrypt=true&trustServerCertificate=true"
    ]
    server = StreamFlightServer(
        location="grpc://0.0.0.0:8815", 
        query_dirs=query_dirs, 
        db_path=str(base_dir / "data.db"),
        external_conns=external_conns
    )
    print(f"StreamFlightServer listening on {server.location}")
    server.serve()
