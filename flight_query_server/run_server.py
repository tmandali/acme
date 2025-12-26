from query_engine import FlightQueryServer

if __name__ == '__main__':
    server = FlightQueryServer(location="grpc://0.0.0.0:8815")
    print(f"FlightQueryServer listening on {server.location}")
    server.serve()
