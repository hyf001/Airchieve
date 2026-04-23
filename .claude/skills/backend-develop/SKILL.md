---
name: backend-develop
description: AIrchieve 项目后端开发技能。当处理后端代码（app/ 目录）时使用此技能，包括创建 API、服务、模型、数据库操作或任何 Python/FastAPI 开发工作。
---

You are the AIrchieve backend development expert. You help users build FastAPI backend features following the project's established patterns and conventions.

## 项目架构

```
app/
├── main.py                 # FastAPI 应用入口、异常处理器
├── api/v1/                 # API 路由层（薄包装）
│   ├── router.py           # 路由聚合
│   ├── deps.py             # 依赖注入（认证��
│   ├── storybook_api.py    # 绘本 API
│   ├── page_api.py         # 页面与图层 API
│   ├── user_api.py         # 用户 API
│   └── *_api.py            # 其他模块端点
├── services/               # 业务逻辑层（核心）
│   ├── storybook_service.py  # 绘本创建、封面生成、页面重新生成
│   ├── page_service.py       # 页面 CRUD 操作
│   ├── layer_service.py      # 图层 CRUD 操作
│   ├── llm_cli.py            # LLM 客户端基类（LLMClientBase）
│   ├── gemini_cli.py         # Gemini 实现（英文 prompt）
│   └── doubao_cli.py         # 豆包实现（中文 prompt）
├── models/                 # ORM 模型
│   ├── enums.py            # 枚举定义（PageType, CliType, StoryType 等）
│   ├── storybook.py        # 绘本模型
│   ├── page.py             # 页面模型（独立表，含分镜 JSON）
│   ├── layer.py            # 图层模型
│   └── base.py             # SQLAlchemy 基类
├── schemas/                # Pydantic 请求/响应模型
│   ├── page.py             # 页面相关 schema
│   ├── storybook.py        # 绘本相关 schema
│   └── media.py            # 媒体相关 schema
├── core/                   # 配置与工具
│   ├── config.py           # pydantic-settings
│   ├── security.py         # JWT、密码
│   └── utils/logger.py     # 日志工具
└── db/session.py           # 异步会话工厂
```

## 核心规范

### 1. 全异步优先

```python
# ✅ 所有数据库操作使用 async/await
async def get_user(user_id: int) -> User | None:
    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

# SQLAlchemy 2.0 异步语法
user = (await session.execute(select(User).where(User.id == id))).scalar_one_or_none()
items = (await session.execute(select(Item).limit(10))).scalars().all()
```

### 2. 分层职责

**API 层 - 薄包装：**
```python
@router.post("")
async def create_endpoint(
    req: RequestSchema,
    current_user: User = Depends(get_current_user),
):
    result = await service_function(...)  # 调用 service
    return result
```

**Service 层 - 业务逻辑：**
```python
async def service_function(...) -> Result:
    async with async_session_maker() as session:
        # 数据库操作、业务规则、外部服务调用
        await session.commit()
    return result
```

### 3. 模型定义

```python
from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, timezone

class YourModel(Base):
    __tablename__ = "your_table"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # 时间戳统一使用 UTC
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )
```

**枚举定义（`models/enums.py`）：**
```python
from enum import Enum

class YourEnum(str, Enum):
    VALUE_1 = "value_1"
    VALUE_2 = "value_2"
```

### 4. 依赖注入

```python
# 数据库会话（自动事务管理）
from app.db.session import get_db
@router.get("")
async def list_items(db: AsyncSession = Depends(get_db)):
    return (await db.execute(select(Item))).scalars().all()

# 认证
from app.api.deps import get_current_user, get_current_admin
@router.post("")
async def create_item(user: User = Depends(get_current_user)):
    pass
```

### 5. 错误处理

```python
# 自定义异常
class InsufficientPointsError(Exception):
    pass

# HTTP 异常
if not item:
    raise HTTPException(status_code=404, detail="项目不存在")

# 全局异常处理器（main.py）
@app.exception_handler(CustomError)
async def custom_error_handler(_request, exc):
    return JSONResponse(status_code=422, content={"code": exc.code, "message": str(exc)})
```

### 6. 后台任务

```python
from fastapi import BackgroundTasks

@router.post("")
async def create_task(
    background_tasks: BackgroundTasks,
):
    # 快速返回，后台执行
    background_tasks.add_task(run_long_task, arg1, arg2)
    return {"status": "init"}

def run_long_task(arg1, arg2):
    asyncio.run(actual_task(arg1, arg2))
```

### 7. 日志

```python
from app.core.utils.logger import get_logger

logger = get_logger(__name__)
logger.info("操作信息 | id=%s param=%d", id, param)
logger.error("错误信息 | error=%s", e, exc_info=True)
```

### 8. 配置

```python
# core/config.py
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
    DATABASE_URL: str = "sqlite+aiosqlite:///data/app.db"
    API_KEY: str = ""

settings = get_settings()

# 使用
from app.core.config import settings
api_key = settings.API_KEY
```

## 页面类型系统

Page 有三种类型（`PageType` 枚举）：

```python
class PageType(str, Enum):
    COVER = "cover"          # 封面（page_index = 0）
    CONTENT = "content"      # 正文页（page_index 1..N）
    BACK_COVER = "back_cover" # 封底（page_index N+1，固定底图）
```

**封底规则：** 使用 `get_back_cover_image_url(aspect_ratio)` 获取固定 OSS 图片 URL，不可 AI 重新生成。

**封面参考页选择：** 使用 `pick_cover_reference_pages(pages)` 从正文页选取首/中/尾作为参考图。

**页面重新生成执行顺序：** text → storyboard → image，不清空已有图层。

## 积分系统

```python
from app.services.points_service import (
    check_creation_points,    # 检查积分是否足够（不扣减）
    consume_for_creation,     # 创建绘本扣减积分
    consume_for_page_edit,    # 页面编辑扣减积分
)

# 创建绘本积分 = 正文页数 + 1（封面）
check_creation_points(user_id, content_count + 1)
```

## LLM 客户端

```python
from app.services.llm_cli import LLMClientBase

# 获取客户端实例
client = LLMClientBase.get_client(cli_type)  # CliType.GEMINI 或 CliType.DOUBAO

# 核心方法
await client.generate_page(...)              # 生成单页图片
await client.edit_image(...)                 # AI 改图
await client.create_story(...)               # 创建纯文本故事
await client.create_storyboard_from_story(...)  # 基于故事创建分镜
await client.generate_cover(...)             # 生成封面图片
await client.regenerate_page_text(...)       # 重新生成页面文本
await client.regenerate_page_storyboard(...) # 重新生成分镜

# 语言注意：
# - Gemini 使用英文 prompt
# - 豆包使用中文 prompt
```

## 核心原则

1. **全异步** - 所有数据库操作使用 async/await
2. **分层清晰** - API 层薄包装，Service 层业务逻辑
3. **UTC 时间** - `datetime.now(timezone.utc)`
4. **枚举优先** - 使用 Enum 而非字符串字面量
5. **依赖注入** - 优先使用 `Depends(get_db)` 自动管理事务

## 参考文件

- [app/api/v1/storybook_api.py](app/api/v1/storybook_api.py) - API 层示例
- [app/api/v1/page_api.py](app/api/v1/page_api.py) - 页面 API（含重新生成端点）
- [app/services/storybook_service.py](app/services/storybook_service.py) - Service 层示例
- [app/services/llm_cli.py](app/services/llm_cli.py) - LLM 客户端基类
- [app/services/gemini_cli.py](app/services/gemini_cli.py) - Gemini 实现
- [app/services/doubao_cli.py](app/services/doubao_cli.py) - 豆包实现
- [app/models/storybook.py](app/models/storybook.py) - 模型示例
- [app/models/enums.py](app/models/enums.py) - 枚举定义
- [app/schemas/page.py](app/schemas/page.py) - Schema 示例
- [app/db/session.py](app/db/session.py) - 会话管理
- [app/core/config.py](app/core/config.py) - 配置管理
