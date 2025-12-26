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
