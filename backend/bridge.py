import sys
import json
import pyarrow as pa
import pyarrow.flight
from dataclasses import asdict

def list_templates(client):
    results = []
    try:
        flights = client.list_flights()
        for flight in flights:
            try:
                cmd = json.loads(flight.descriptor.command.decode('utf-8'))
                results.append(cmd)
            except:
                pass
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
        
    print(json.dumps(results))

def execute_query(client, command_json):
    try:
        # Command is already in the expected format {"template": "...", "criteria": ...}
        descriptor = pa.flight.FlightDescriptor.for_command(command_json.encode('utf-8'))
        info = client.get_flight_info(descriptor)
        reader = client.do_get(info.endpoints[0].ticket)
        
        # Signal start of stream
        print(json.dumps({"type": "metadata", "success": True}))
        sys.stdout.flush()

        while True:
            try:
                chunk = reader.read_chunk()
                if chunk.data:
                    data = chunk.data.to_pylist()
                    if data:
                        print(json.dumps({"type": "batch", "data": data}))
                        sys.stdout.flush()
            except StopIteration:
                break
            except Exception as e:
                # Handle potential errors during reading
                print(json.dumps({"type": "error", "error": str(e)}))
                sys.stdout.flush()
                break

    except Exception as e:
        print(json.dumps({"type": "error", "error": str(e)}))
        sys.stdout.flush()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python bridge.py <list|exec> [command_json]")
        sys.exit(1)

    action = sys.argv[1]
    location = "grpc://0.0.0.0:8815"
    
    try:
        client = pa.flight.connect(location)
    except Exception as e:
        print(json.dumps({"error": f"Connection failed: {str(e)}"}))
        sys.exit(1)

    if action == "list":
        list_templates(client)
    elif action == "exec":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing command JSON"}))
            sys.exit(1)
        execute_query(client, sys.argv[2])
    else:
        print(json.dumps({"error": "Invalid action"}))
        sys.exit(1)
