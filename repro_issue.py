
import logging
import threading
from jinja2 import Environment

# We need to make sure we can import these
try:
    from backend.query_engine.reader_extensions import ReaderExtension
    from backend.query_engine.py_extensions import PythonExtension
except ImportError:
    import sys
    import os
    sys.path.append(os.getcwd())
    from backend.query_engine.reader_extensions import ReaderExtension
    from backend.query_engine.py_extensions import PythonExtension

# Mock logging
logging.basicConfig(level=logging.INFO)

def test_reader_parsing(sql_body, name):
    env = Environment(extensions=[ReaderExtension, PythonExtension])
    env.globals["TRUE"] = True
    
    template_str = f"""{{% reader 'depo', 'TestOltp.Retail', TRUE %}}
{sql_body}
{{% endreader %}}"""

    print(f"Testing {name}...")
    try:
        t = env.from_string(template_str)
        print("Parse successful!")
    except Exception as e:
        print(f"Parse FAILED: {e}")

if __name__ == "__main__":
    test_reader_parsing("select d.Kod, d.Tanim from tb_Depo d ;", "Normal Space")
    test_reader_parsing("select d.Kod, d.Tanim from tb_Depo d\t;", "Tab")
    test_reader_parsing("select d.Kod, d.Tanim from tb_Depo d\n;", "Newline")
    test_reader_parsing("select d.Kod, d.Tanim from tb_Depo d\r\n;", "CRLF")
    test_reader_parsing("select d.Kod, d.Tanim from tb_Depo d\xa0;", "Non-breaking Space")
