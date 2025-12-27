import os
import json
import sqlite3
import pathlib
import threading
import time
import pytest
from datetime import datetime, timedelta
import pyarrow as pa
import pyarrow.flight
from query_engine.server import FlightQueryServer
from query_engine.filters import (
    filter_quote, filter_sql, filter_between, filter_eq, filter_add_days,
    filter_gt, filter_lt, filter_gte, filter_lte, filter_ne, filter_like,
    filter_start, filter_end
)
from query_engine.models import SqlWrapper, QueryCommand
from query_engine.utils import evaluate_template_value

# --- Birim Testler (Unit Tests) ---

def test_sqlite_to_arrow_type():
    """SQLite tip isimlerinin Arrow tiplerine dönüşümünü test eder."""
    from query_engine.types import sqlite_to_arrow_type
    assert sqlite_to_arrow_type("INTEGER") == pa.int64()
    assert sqlite_to_arrow_type("INT") == pa.int64()
    assert sqlite_to_arrow_type("REAL") == pa.float64()
    assert sqlite_to_arrow_type("FLOAT") == pa.float64()
    assert sqlite_to_arrow_type("DOUBLE") == pa.float64()
    assert sqlite_to_arrow_type("BOOLEAN") == pa.bool_()
    assert sqlite_to_arrow_type("VARCHAR") == pa.string()
    assert sqlite_to_arrow_type(None) == pa.string()

def test_sql_wrapper_logic():
    """SqlWrapper'ın string dönüşümü ve sarmalama mantığını test eder."""
    wrapper = SqlWrapper("20230101", "MY_COL")
    assert str(wrapper) == "20230101"
    assert wrapper.__html__() == "20230101"
    assert wrapper.name == "MY_COL"

def test_evaluate_template_value_advanced():
    """Kriterler içinde Jinja filtrelerinin rendering edilmesini test eder."""
    from jinja2 import Environment
    from query_engine.filters import filter_add_days
    
    # Filtrelerin olduğu bir ortam hazırla
    env = Environment()
    env.filters["add_days"] = filter_add_days
    
    # Filtre ile test
    res = evaluate_template_value("{{ now | add_days(-1) }}", now_str="20240101", jinja_env=env)
    assert res == "20231231"
    
    # Filtresiz düz render
    res = evaluate_template_value("Bugün: {{ now }}", now_str="20240101")
    assert res == "Bugün: 20240101"
    
    # Standart aritmetik (rendering sonrası kalan)
    res = evaluate_template_value("20240101 +1d")
    assert res == "20240102"

def test_filter_quote():
    """quote filtresinin metinleri ve listeleri doğru şekilde tırnak içine aldığını test eder."""
    assert filter_quote("test") == "'test'"
    assert filter_quote(123) == "123"
    assert filter_quote([1, "2"]) == "1, '2'"
    assert filter_quote(None) == "NULL"

def test_filter_sql():
    """sql filtresinin farklı veri tiplerini (bool, list, int) SQL formatına çevirdiğini test eder."""
    assert filter_sql("test") == "'test'"
    assert filter_sql(123) == "123"
    assert filter_sql(["a", 1]) == "('a', 1)"
    assert filter_sql(True) == "1"
    assert filter_sql(False) == "0"
    assert filter_sql(None) == "NULL"

def test_filter_between():
    """between filtresinin başlangıç ve bitiş değerlerini doğru SQL aralığına çevirdiğini test eder."""
    val = {"start": "20230101", "end": "20230131"}
    assert filter_between(val, "col") == "col BETWEEN '20230101' AND '20230131'"
    # SqlWrapper ile otomatik isim tespiti
    wrapped = SqlWrapper(val, "auto_col")
    assert filter_between(wrapped) == "auto_col BETWEEN '20230101' AND '20230131'"

def test_filter_eq():
    """eq filtresinin tekil ve çoklu seçimlerde doğru '=' veya 'IN' operatörlerini kurduğunu test eder."""
    assert filter_eq("val", "col") == "col = 'val'"
    assert filter_eq(["a", "b"], "col") == "col IN ('a', 'b')"
    # SqlWrapper ile otomatik isim tespiti
    wrapped = SqlWrapper("val", "auto_col")
    assert filter_eq(wrapped) == "auto_col = 'val'"

def test_filter_add_days():
    """add_days filtresinin tarihe gün eklediğini doğrular."""
    assert filter_add_days("20230101", 5) == "20230106"
    assert filter_add_days("20231231", 1) == "20240101"

def test_comparison_filters():
    """gt, lt, gte, lte, ne filtrelerini test eder."""
    col = "PRICE"
    assert filter_gt(100, col) == "PRICE > 100"
    assert filter_lt(100, col) == "PRICE < 100"
    assert filter_gte(100, col) == "PRICE >= 100"
    assert filter_lte(100, col) == "PRICE <= 100"
    assert filter_ne(100, col) == "PRICE <> 100"
    assert filter_ne(["A", "B"], col) == "PRICE NOT IN ('A', 'B')"

def test_filter_like():
    """like filtresini test eder."""
    assert filter_like("abc", "NAME") == "NAME LIKE '%abc%'"

def test_range_access_filters():
    """start ve end filtrelerini test eder."""
    val = {"start": "S", "end": "E"}
    assert filter_start(val) == "S"
    assert filter_end(val) == "E"

# --- Entegrasyon Testleri (Integration Tests) ---

@pytest.fixture(scope="module")
def server():
    """Testler için sunucu ve DB ayarlarını yapar."""
    db_path = "test_data_integ.db"
    if os.path.exists(db_path): os.remove(db_path)
    
    os.makedirs("test_templates", exist_ok=True)
    with open("test_templates/test_query.yaml", "w") as f:
        f.write("sql: \"SELECT * FROM test_table WHERE {{ID|eq}} AND {{CREATED_AT|between}}\"")
    
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE test_table (ID INTEGER, CREATED_AT TEXT)")
    conn.execute("INSERT INTO test_table VALUES (1, '20230101'), (2, '20230115'), (3, '20230130')")
    conn.commit()
    conn.close()

    location = "grpc://0.0.0.0:8817"
    server = FlightQueryServer(location=location, query_dirs=[pathlib.Path("test_templates")], db_path=db_path)
    
    def run_server(): server.serve()
    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    time.sleep(1)
    
    yield location
    if os.path.exists(db_path): os.remove(db_path)

def test_query_command_structure(server):
    """QueryCommand yapısının ve YAML render'ın doğruluğunu test eder."""
    client = pa.flight.connect(server)
    command = {
        "template": "test_query.yaml",
        "criteria": {
            "ID": 1,
            "CREATED_AT": {"start": "20230101", "end": "20230110"}
        }
    }
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    info = client.get_flight_info(descriptor)
    reader = client.do_get(info.endpoints[0].ticket)
    table = reader.read_all()
    assert table.num_rows == 1
    assert table.to_pandas()["ID"].iloc[0] == 1

def test_relative_date_parsing(server):
    """{{now}} ve bağıl tarihlerin integration seviyesinde çözüldüğünü doğrular."""
    client = pa.flight.connect(server)
    now_val = datetime.now().strftime("%Y%m%d")
    
    # Bugünün kaydını ekleyelim teste özel (Farklı DB olacağı için fixture'a eklemek daha iyi ama burada hızlıca yapalım)
    conn = sqlite3.connect("test_data_integ.db")
    conn.execute("INSERT INTO test_table VALUES (99, ?)", (now_val,))
    conn.commit()
    conn.close()

    command = {
        "template": "test_query.yaml",
        "criteria": {
            "ID": 99,
            "CREATED_AT": {"start": "{{now}} -1d", "end": "{{now}} +1d"}
        }
    }
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    info = client.get_flight_info(descriptor)
    reader = client.do_get(info.endpoints[0].ticket)
    table = reader.read_all()
    assert table.num_rows == 1

def test_error_handling_missing_template(server):
    """Olmayan bir şablon istendiğinde uygun hata döndüğünü doğrular."""
    client = pa.flight.connect(server)
    command = {"template": "missing.yaml", "criteria": {}}
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    
    with pytest.raises(Exception): # Flight server error
        client.get_flight_info(descriptor)

def test_empty_yaml_field(server):
    """YAML dosyasında 'sql' alanı eksikse hata fırlatıldığını test eder."""
    os.makedirs("test_templates", exist_ok=True)
    with open("test_templates/empty_sql.yaml", "w") as f:
        f.write("name: test\n") # 'sql' alanı yok
        
    client = pa.flight.connect(server)
    command = {"template": "empty_sql.yaml", "criteria": {}}
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    
    with pytest.raises(Exception):
        client.get_flight_info(descriptor)

def test_list_flights(server):
    """list_flights metodunun şablonları ve metaverilerini doğru döndürdüğünü test eder."""
    client = pa.flight.connect(server)
    
    # Sunucudan uçuşları (şablonları) iste
    flights = list(client.list_flights())
    
    # En az bir şablon dönmeli (test_query.yaml oluşturulmuştu)
    assert len(flights) >= 1
    
    # İlk şablonun içeriğini kontrol et
    found = False
    for flight in flights:
        cmd = json.loads(flight.descriptor.command.decode('utf-8'))
        if cmd["template"] == "test_query.yaml":
            found = True
            metadata = cmd.get("metadata", {})
            # TemplateMetadata yapısına uygun mu?
            assert metadata["name"] == "test_query.yaml"
            assert "params" in metadata
            break
            
    assert found, "test_query.yaml sunucu tarafından listelenmedi."

def test_server_batching_and_types(server):
    """Büyük veri setinde batching mantığını ve tip çıkarımını doğrular."""
    # Test DB'ye çok sayıda ve farklı tiplerde veri ekle
    conn = sqlite3.connect("test_data_integ.db")
    conn.execute("CREATE TABLE types_test (id INTEGER, amount REAL, is_active BOOLEAN)")
    
    # 1500 satır ekle (Batch size genelde 1000 civarıdır)
    data = [(i, float(i)*1.1, i % 2 == 0) for i in range(1500)]
    conn.executemany("INSERT INTO types_test VALUES (?, ?, ?)", data)
    conn.commit()
    conn.close()
    
    # Template oluştur
    with open("test_templates/types_query.yaml", "w") as f:
        f.write("sql: \"SELECT * FROM types_test\"")
        
    client = pa.flight.connect(server)
    command = {"template": "types_query.yaml", "criteria": {}}
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    
    # Veriyi çek
    info = client.get_flight_info(descriptor)
    reader = client.do_get(info.endpoints[0].ticket)
    
    # Batch kontrolü (En az 2 batch olmalı: 1000 + 500)
    batches = []
    total_rows = 0
    for chunk in reader:
        batches.append(chunk.data)
        total_rows += chunk.data.num_rows
        
    assert total_rows == 1500
    assert len(batches) >= 2
    
    # Tip kontrolü (Schema inference)
    # Not: SQLite'ta BOOLEAN aslında 0/1 integer'dır, Arrow buna int64 diyebilir. 
    # Ancak REAL -> double olmalı.
    table = pa.Table.from_batches(batches)
    schema = table.schema
    
    # Basit tip kontrolü (Python objelerinden çıkarım nedeniyle)
    # id (int) -> int64
    # amount (float) -> double
    assert pa.types.is_float64(schema.field("amount").type) or pa.types.is_float32(schema.field("amount").type)
    assert pa.types.is_integer(schema.field("id").type)

def test_list_flights_resilience(server):
    """Bozuk YAML dosyalarının listeleme işlemini durdurmadığını test eder."""
    # Bozuk bir YAML dosyası oluştur
    with open("test_templates/broken.yaml", "w") as f:
        f.write(":: BU GEÇERSİZ BİR YAML DOSYASIDIR ::")
        
    client = pa.flight.connect(server)
    flights = list(client.list_flights())
    
    # Sunucu hatayı yutup (loglayıp) diğer geçerli şablonları dönmeli
    # test_query.yaml ve types_query.yaml hala gelmeli
    valid_templates = [json.loads(f.descriptor.command.decode('utf-8'))["template"] for f in flights]
    assert "test_query.yaml" in valid_templates
    assert "broken.yaml" not in valid_templates

def test_runtime_sql_error(server):
    """SQL syntax hatası veya olmayan tablo hatasının do_get içinde yakalandığını doğrular."""
    # Hatalı SQL içeren şablon
    with open("test_templates/bad_sql.yaml", "w") as f:
        f.write("sql: \"SELECT * FROM non_existent_table_xyz\"")
        
    client = pa.flight.connect(server)
    command = {"template": "bad_sql.yaml", "criteria": {}}
    descriptor = pa.flight.FlightDescriptor.for_command(json.dumps(command).encode('utf-8'))
    
    # get_flight_info aşamasında LIMIT 0 ile şema çıkarılırken hata alınmalı
    with pytest.raises(Exception) as excinfo:
        client.get_flight_info(descriptor)
    
    assert "Flight implementation error" in str(excinfo.value) or "no such table" in str(excinfo.value)
