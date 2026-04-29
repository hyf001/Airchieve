"""
SQLAlchemy Base Model
数据库模型基类
"""
import json
from enum import Enum

from pydantic import BaseModel
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import Text, TypeDecorator


class Base(DeclarativeBase):
    """所有数据库模型的基类"""
    pass


class JsonText(TypeDecorator):
    """以 Text 存储 JSON，兼容低版本 MariaDB"""
    impl = Text
    cache_ok = True

    @staticmethod
    def _to_jsonable(value):
        if isinstance(value, BaseModel):
            if hasattr(value, "model_dump"):
                return JsonText._to_jsonable(value.model_dump(mode="json"))
            return JsonText._to_jsonable(value.dict())
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, list):
            return [JsonText._to_jsonable(v) for v in value]
        if isinstance(value, dict):
            return {k: JsonText._to_jsonable(v) for k, v in value.items()}
        return value

    def process_bind_param(self, value, dialect):
        if value is not None:
            return json.dumps(self._to_jsonable(value), ensure_ascii=False)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            return json.loads(value)
        return value
