import re
from datetime import datetime, timedelta
from jinja2 import Template

def evaluate_template_value(v, now_str=None, jinja_env=None):
    """
    Kriter değerlerini işler. Önce Jinja render eder, sonra bağıl tarih aritmetiğini çözer.
    """
    if not isinstance(v, str) or not v:
        return v
    
    now = now_str or datetime.now().strftime("%Y%m%d")
    processed = v
    
    # 1. Jinja Render (Örn: {{ now | add_days(-7) }})
    if "{{" in processed:
        try:
            # Eğer bir environment varsa onu kullan (filtreler için), yoksa geçici oluştur
            if jinja_env:
                template = jinja_env.from_string(processed)
                processed = template.render(now=now)
            else:
                # Basit render (filtreler olmayabilir)
                processed = Template(processed).render(now=now)
        except Exception:
            # Hata durumunda {{now}} değişimini manuel dene (fallback)
            processed = processed.replace("{{now}}", now).replace("{{ now }}", now)
    
    # 2. Bağıl tarih hesapla (Örn: 20241224 -1d)
    # Bu kısım render sonrası kalan aritmetiği (string sonundaki -7d gibi) çözer
    match = re.search(r"(\d{8})\s*([+-])\s*(\d+)([dmw])", processed)
    if match:
        base_date_str, op, amount, unit = match.groups()
        try:
            base_date = datetime.strptime(base_date_str, "%Y%m%d")
            days = int(amount)
            if op == '-': days = -days
            
            if unit == 'd': delta = timedelta(days=days)
            elif unit == 'w': delta = timedelta(weeks=days)
            elif unit == 'm': delta = timedelta(days=days * 30)
            else: delta = timedelta(0)
            
            result_date = base_date + delta
            processed = result_date.strftime("%Y%m%d")
        except Exception:
            pass
            
    return processed
