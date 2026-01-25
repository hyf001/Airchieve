"""
SQLAlchemy Base Model
数据库模型基类
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有数据库模型的基类"""
    pass
