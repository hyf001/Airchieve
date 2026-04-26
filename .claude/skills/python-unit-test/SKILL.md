---
name: python-unit-test
description: 专门用于 Python 单元测试工作的技能。仅当用户明确要求编写、生成、运行、改进或调试 Python 单元测试时使用此技能。适用于当前仓库的 FastAPI 后端，优先面向 `app/` 目录下的模块、接口、服务层与数据层测试。不用于一般功能开发、随手排查或非测试任务。
---

# Python 单元测试指南

面向当前项目时，默认按 AIrchieve 后端结构工作：

- 被测代码在 `app/`
- 测试文件放在 `tests/`
- Python 解释器优先使用 `.venv/bin/python`
- `tests/conftest.py` 负责把项目根目录加入 `sys.path`
- 接口入口是 `app.main:app`
- 依赖通过 `requirements.txt` 管理

## 什么时候使用

仅在用户明确表达测试意图时触发，例如：

- “给这个模块写单元测试”
- “运行 pytest”
- “补测试覆盖率”
- “调试测试失败”

不要在普通功能开发或代码评审时自动切到这个技能。

## 工作流程

1. 先读被测代码，再决定测试范围。
2. 判断测试类型：
   - 纯函数或工具函数：优先写真正的单元测试
   - `services/`：优先 mock 外部依赖、数据库、HTTP 调用
   - `api/v1/`：优先写接口测试，使用 FastAPI 测试客户端覆盖状态码、响应体、鉴权和错误分支
3. 如需新建测试文件，先运行：

```bash
.venv/bin/python .codex/skills/python-unit-test/scripts/create_test_file.py app/path/to/module.py
```

4. 再补充真实测试用例，不要保留空洞模板。
5. 运行最小必要范围的测试：

```bash
.venv/bin/python -m pytest tests/path/to/test_module.py -v
```

6. 如果失败，先判断是测试设计问题还是源代码 bug。不要为了“让测试通过”去掩盖真实缺陷。

## AIrchieve 项目约定

### 测试目录

- 默认使用 `tests/`
- 保持与 `app/` 相同的子目录结构
- 示例：
  - 源文件：`app/services/storybook_service.py`
  - 测试文件：`tests/services/test_storybook_service.py`

### 推荐的导入方式

优先从 `app...` 导入被测对象，例如：

```python
from app.main import app
from app.services.storybook_service import StorybookService
```

### 包导入约定

当前项目没有现成的打包配置来保证 `tests/` 下总能直接导入 `app`，所以默认依赖 `tests/conftest.py`：

- 向 `sys.path` 注入项目根目录
- 固定必要的测试环境变量，避免本机环境污染导入阶段
- 保证 `from app... import ...` 在 `pytest` 下稳定可用
- 不要求把项目安装成可编辑包

脚本首次创建测试文件时，应同时确保 `tests/conftest.py` 存在。

### 接口测试建议

- 优先覆盖 `GET /health` 这类稳定接口的模式，再迁移到业务接口
- 对 API 路由，重点验证：
  - 状态码
  - 响应 JSON 结构
  - 参数校验失败
  - 认证/权限分支
  - 服务层抛错后的返回

常见模式：

```python
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_check():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
```

如果接口依赖异步服务、数据库或外部 HTTP，请优先 patch 服务层边界，而不是直接打真实依赖。

### 服务层测试建议

- 对数据库访问使用 mock / stub，避免碰真实库
- 对 `httpx.AsyncClient`、第三方 SDK、OSS、支付、LLM 调用全部 mock
- 优先验证：
  - 输入到输出的业务转换
  - 分支逻辑
  - 异常传播或错误包装

异步函数测试示例：

```python
import pytest


@pytest.mark.asyncio
async def test_async_behavior():
    result = await some_async_function()
    assert result == "expected"
```

## 编写要求

- 每个测试只验证一个明确行为
- 命名直接表达意图，例如 `test_health_check_returns_healthy_status`
- 优先小范围、低耦合、可重复执行的测试
- 测试行为，不测试实现细节
- 能 mock 的外部依赖尽量 mock

## 失败处理原则

- 如果测试合理而结果失败，优先报告源码问题
- 只有确认测试设计错误时才修改测试
- 不要通过降低断言强度、移除关键分支或迎合当前错误行为来“修绿”

## 执行命令

```bash
# 运行单个测试文件
.venv/bin/python -m pytest tests/services/test_storybook_service.py -v

# 运行单个测试
.venv/bin/python -m pytest tests/api/v1/test_health.py::test_health_check -v

# 查看更详细失败信息
.venv/bin/python -m pytest tests/path/to/test_module.py -vv
```

如果 `.venv` 里还没有测试依赖，优先安装到 `.venv` 后再运行；不要让脚本自动改动依赖配置文件，也不要混用系统 Python。
