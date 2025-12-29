import json
from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from .utils import evaluate_template_value

@dataclass
class QueryCommand:
    template: str
    criteria: Dict[str, Any] = field(default_factory=dict)
    query: Optional[str] = None
    session_id: str = "default"
    
    @classmethod
    def from_json(cls, json_str: str) -> 'QueryCommand':
        data = json.loads(json_str)
        return cls(
            template=data.get("template", ""),
            criteria=data.get("criteria", {}),
            query=data.get("query"),
            session_id=data.get("session_id", "default")
        )

@dataclass
class TemplateParam:
    name: str
    label: Optional[str] = None
    type: str = "text"
    required: bool = False
    default: Optional[str] = None

@dataclass
class TemplateMetadata:
    name: str
    description: Optional[str] = None
    sql: str = ""
    params: list[TemplateParam] = field(default_factory=list)

    @classmethod
    def from_dict(cls, name: str, data: dict) -> 'TemplateMetadata':
        params_raw = data.get("params", [])
        params = []
        for p in params_raw:
            params.append(TemplateParam(
                name=p.get("name"),
                label=p.get("label"),
                type=p.get("type", "text"),
                required=p.get("required", False),
                default=p.get("default")
            ))
        
        return cls(
            name=name,
            description=data.get("description"),
            sql=data.get("sql", ""),
            params=params
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
