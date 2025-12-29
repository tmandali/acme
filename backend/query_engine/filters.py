from datetime import datetime, timedelta
import re

# Yardımcı fonksiyon: SQL değerlerini güvenli formatlar
def format_sql_value(v):
    if v is None or v == "": return None
    return str(v) if isinstance(v, (int, float)) else f"'{v}'"

def resolve_empty_value(f, empty_val_template, default_sql=""):
    if not empty_val_template: return default_sql
    return empty_val_template.replace("{{ field }}", f or "").replace("{{field}}", f or "")

def get_val_and_field(val, field_name=None):
    v = val.value if hasattr(val, 'value') else val
    f = field_name or (val.name if hasattr(val, 'name') else None)
    # TypeScript'teki 'empty' (emptyValue) mantığı da SqlWrapper'a eklenebilir 
    # Ama şu anki Python yapımızda SqlWrapper'da sadece value ve name var.
    # Şimdilik model'e dokunmadan en temel haliyle gidelim.
    return v, f

# --- Temel Filtreler ---

def filter_quote(val):
    v = val.value if hasattr(val, 'value') else val
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, list): return ", ".join(f"'{i}'" if isinstance(i, str) else str(i) for i in v)
    if v is None: return "NULL"
    return f"'{v}'"

def filter_sql(val):
    v = val.value if hasattr(val, 'value') else val
    if v is None or v == "": return "NULL"
    if isinstance(v, bool): return "1" if v else "0"
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, list):
        if not v: return "NULL"
        joined = ", ".join(f"'{i}'" if isinstance(i, str) else str(i) for i in v)
        return f"({joined})"
    return f"'{v}'"

# --- Karşılaştırma Filtreleri (gt, lt, gte, lte, ne, eq, like) ---

def filter_gt(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    formatted = format_sql_value(v)
    return f"{f} > {formatted}" if f else f"> {formatted}" if formatted else ""

def filter_lt(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    formatted = format_sql_value(v)
    return f"{f} < {formatted}" if f else f"< {formatted}" if formatted else ""

def filter_gte(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    formatted = format_sql_value(v)
    return f"{f} >= {formatted}" if f else f">= {formatted}" if formatted else ""

def filter_lte(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    formatted = format_sql_value(v)
    return f"{f} <= {formatted}" if f else f"<= {formatted}" if formatted else ""

def filter_ne(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    if v is None or v == "": return ""
    if isinstance(v, list):
        if not v: return ""
        joined = ", ".join(f"'{i}'" if isinstance(i, str) else str(i) for i in v)
        return f"{f} NOT IN ({joined})" if f else f"NOT IN ({joined})"
    formatted = format_sql_value(v)
    return f"{f} <> {formatted}" if f else f"<> {formatted}"

def filter_eq(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    if v is None or v == "": return ""
    if isinstance(v, list):
        if not v: return ""
        joined = ", ".join(f"'{i}'" if isinstance(i, str) else str(i) for i in v)
        return f"{f} IN ({joined})" if f else f"IN ({joined})"
    formatted = format_sql_value(v)
    return f"{f} = {formatted}" if f else f"= {formatted}"

def filter_like(val, field_name=None):
    v, f = get_val_and_field(val, field_name)
    if v is None or v == "": return ""
    return f"{f} LIKE '%{v}%'" if f else f"LIKE '%{v}%'"

# --- Aralık Filtreleri (between, start, end) ---

def filter_between(val, field_name=None, options=None):
    v, f = get_val_and_field(val, field_name)
    if not isinstance(v, dict): return ""
    
    start = v.get("start") or v.get("begin")
    end = v.get("end") or v.get("finish")
    
    if not start and not end: return ""
    
    f_start = format_sql_value(start) or "NULL"
    f_end = format_sql_value(end) or "NULL"
    
    prefix = f"{f} BETWEEN " if f else "BETWEEN "
    return f"{prefix}{f_start} AND {f_end}"

def filter_start(val):
    v = val.value if hasattr(val, 'value') else val
    return (v.get("start") or v.get("begin")) if isinstance(v, dict) else v

def filter_end(val):
    v = val.value if hasattr(val, 'value') else val
    return (v.get("end") or v.get("finish")) if isinstance(v, dict) else v

# --- Tarih Filtreleri ---

def filter_add_days(val, days):
    try:
        v = val.value if hasattr(val, 'value') else val
        if not v: return v
        date_str = str(v)
        # YYYYMMDD formatı kontrolü
        if len(date_str) == 8:
            d = datetime.strptime(date_str, "%Y%m%d")
        else:
            # Diğer formatlar için (basitçe)
            d = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            
        res = d + timedelta(days=int(days))
        return res.strftime("%Y%m%d")
    except:
        return val
