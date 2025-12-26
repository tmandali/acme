import json
import pyarrow as pa
import pyarrow.flight

def run_example():
    client = pa.flight.connect("grpc://0.0.0.0:8815")
    
    # Yeni yapılandırılmış komut (QueryCommand JSON formatı)
    command = {
        "template": "test2.yaml",
        "criteria": {
            "ID": 101,
            "SOURCE": ["1", "2"],
            "CREATED_AT": {
                "start": "{{now}} -30d",
                "end": "{{now}}"
            }
        }
    }
    
    # Komutu FlightDescriptor olarak gönder
    print(f"Sorgu gönderiliyor: {command['template']}...")
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    
    # Metadata al
    flight_info = client.get_flight_info(descriptor)
    print("Sema:", flight_info.schema)
    
    # Veriyi akış olarak oku
    reader = client.do_get(flight_info.endpoints[0].ticket)
    
    table = reader.read_all()
    df = table.to_pandas()
    
    print("\nSonuçlar:")
    if df.empty:
        print("Kayıt bulunamadı.")
    else:
        print(df)

if __name__ == '__main__':
    try:
        run_example()
    except Exception as e:
        print(f"Hata: {e}")
        print("\nİpucu: Sunucunun (run_server.py) çalıştığından emin olun.")