import pyarrow as pa

def sqlite_to_arrow_type(sqlite_type_name: str):
    """
    SQLite tip isimlerini PyArrow tiplerine çevirir.
    """
    if not sqlite_type_name:
        return pa.string()
    
    t = sqlite_type_name.upper()
    if "INT" in t:
        return pa.int64()
    if "REAL" in t or "FLOAT" in t or "DOUBLE" in t:
        return pa.float64()
    if "BOOL" in t:
        return pa.bool_()
    if "DATE" in t or "TIME" in t:
        return pa.string()  # SQLite'ta tarihler genelde string saklanır
    
    return pa.string()
