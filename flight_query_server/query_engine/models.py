import json
from dataclasses import dataclass, field
from typing import Dict, Any
from .utils import evaluate_template_value

@dataclass
class QueryCommand:
    template: str
    criteria: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'QueryCommand':
        data = json.loads(json_str)
        return cls(
            template=data.get("template", ""),
            criteria=data.get("criteria", {})
        )

class SqlWrapper:
    """
    Değişken değerlerini sarmalayan ve filtrelerin alan adını (name) 
    bilmesini sağlayan yardımcı sınıf.
    """
    def __init__(self, value, name, jinja_env=None):
        if isinstance(value, str):
            self.value = evaluate_template_value(value, jinja_env=jinja_env)
        elif isinstance(value, dict):
            self.value = {k: evaluate_template_value(v, jinja_env=jinja_env) for k, v in value.items()}
        else:
            self.value = value
        self.name = name
    def __html__(self): return str(self.value)
    def __str__(self): return str(self.value)
