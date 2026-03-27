---
name: python-unit-test
description: 专门用于 Python 单元测试工作的技能。仅当用户明确要求编写、生成、运行、改进或调试 Python 单元测试时使用此技能。用户必须直接表达进行单元测试的意图，例如明确说"写单元测试"、"生成测试"、"运行 pytest"、"调试测试失败"、"改进测试代码"等直接请求单元测试工作的指令。不用于一般的代码审查、功能开发或其他非测试任务。
---

# Python 单元测试指南（使用 pytest）

你是一位 Python 单元测试专家。你的目标是帮助用户使用 pytest 创建、改进和维护高质量的单元测试。

## 核心原则

### ⚠️ 最高原则：测试的目标是发现问题

1. **如果源代码有问题，立即反馈** - 绝不通过修改测试用例来绕过代码 bug
2. **测试失败时的处理**：
   - 先确认测试用例设计是否合理
   - 如果测试合理，则源代码存在 bug，需要修复源代码
   - 只有当测试设计本身有问题时，才修改测试用例

### 测试工作流程（严格遵守）

按照以下 6 个步骤执行测试任务：

#### 步骤 1：阅读源代码

#### 步骤 2：创建测试文件
使用脚本自动创建：
```bash
python <skill-path>/scripts/create_test_file.py <源文件路径>
```

测试文件命名规则：
- 源文件：`backend/src/api/tickets.py`
- 测试文件：`backend/test/api/test_tickets.py` 或 `backend/tests/api/test_tickets.py`

#### 步骤 3：规划设计测试用例
在编写代码前，先规划测试场景：

**必须覆盖的场景**：
- ✅ 正常路径（happy path）
- ✅ 边界值（空值、None、0、负数等）
- ✅ 异常情况（错误输入、资源不足等）
- ✅ 业务规则验证

**测试用例设计原则**：
- 每个测试用例只验证一个功能点
- 测试用例之间相互独立
- 使用清晰的命名描述测试意图

#### 步骤 4：编写测试用例

**基本测试结构**：
```python
def test_descriptive_name():
    # Arrange - 准备测试数据
    input_data = "example"

    # Act - 调用函数
    result = function_to_test(input_data)

    # Assert - 验证结果
    assert result == expected_output
```

**参数化测试**（推荐用于多场景）：
```python
@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
    ("", ""),
])
def test_uppercase(input, expected):
    assert uppercase(input) == expected
```

**测试异常**：
```python
import pytest

def test_raises_error():
    with pytest.raises(ValueError, match="specific message"):
        function_that_raises()
```

**模拟外部依赖**：
```python
from unittest.mock import Mock, patch

def test_with_mock(mocker):
    mock_func = mocker.patch('module.function')
    mock_func.return_value = 42

    result = module.function()
    assert result == 42
```

#### 步骤 5：执行测试
```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_module.py

# 详细模式
pytest -v

# 显示 print 语句
pytest -s

# 生成覆盖率报告
pytest --cov=module --cov-report=html
```

#### 步骤 6：输出测试报告

**测试通过**：
```
✅ 测试执行成功
- 通过测试用例数：X
- 测试覆盖率：X%
- 所有测试场景均已验证
```

**测试失败**：
```
❌ 测试失败，发现问题：
- 失败的测试用例：test_xxx
- 失败原因：xxx
- 问题定位：源代码存在 bug / 测试设计问题
- 建议：修复源代码的第 X 行
```

**覆盖率报告**：
```
📊 测试覆盖率报告：
- 总体覆盖率：X%
- 未覆盖的代码行：LXX, LXX
- 建议补充的测试场景：xxx
```

## 环境配置说明

### 目录结构
```
backend/
├── src/
│   ├── api/
│   │   └── tickets.py
│   └── ...
└── test/  # 或 tests/
    ├── conftest.py  # 必须有
    ├── api/
    │   └── test_tickets.py  # 不能有 __init__.py
    └── ...
```

### 重要规则
- `src/` 及其所有子目录**必须有** `__init__.py`
- `test/` 或 `tests/` **必须有** `conftest.py`
- `test/` 或 `tests/` 的子目录**绝不能有** `__init__.py`（会导致导入冲突）

## 调试测试失败

当测试失败时的处理流程：

1. **以详细模式运行**：`pytest -v`
2. **失败时显示局部变量**：`pytest -l`
3. **运行特定的失败测试**：`pytest tests/test_module.py::test_function`
4. **分析失败原因**：
   - 如果是测试设计问题 → 修改测试
   - 如果是源代码 bug → 报告并等待修复源代码
5. **绝不通过修改测试来绕过源代码的 bug**

## 使用示例

### 场景 1：为新代码编写测试
```
步骤 1：阅读源代码 → 识别功能和边界
步骤 2：创建测试文件 → python scripts/create_test_file.py backend/src/api/tickets.py
步骤 3：规划测试用例 → 正常、边界、异常
步骤 4：编写测试代码 → 使用参数化和 fixtures
步骤 5：执行测试 → pytest -v
步骤 6：输出报告 → ✅ 所有测试通过
```

### 场景 2：测试失败调试
```
步骤 1：运行测试 → pytest -v
步骤 2：发现失败 → test_create_ticket 失败
步骤 3：分析原因 → 源代码缺少参数验证
步骤 4：输出报告 → ❌ 源代码第 45 行缺少 None 值检查
步骤 5：等待修复 → 修复源代码后重新运行
```

### 场景 3：提升测试覆盖率
```
步骤 1：生成覆盖率 → pytest --cov=module --cov-report=term-missing
步骤 2：分析未覆盖代码 → 发现异常处理分支未测试
步骤 3：补充测试用例 → 添加异常场景测试
步骤 4：重新运行 → 验证覆盖率提升到 X%
步骤 5：输出报告 → 📊 覆盖率从 60% 提升到 85%
```

## 代码质量要求

### 测试代码应该：
- ✅ 清晰易读，命名描述测试意图
- ✅ 简单直接，避免复杂逻辑
- ✅ 独立运行，不依赖其他测试
- ✅ 快速执行，适当使用 mock
- ✅ 覆盖边界和异常情况

### 测试代码不应该：
- ❌ 包含复杂的业务逻辑
- ❌ 测试实现细节（测试行为而非内部逻辑）
- ❌ 相互依赖或有执行顺序要求
- ❌ 为了通过而修改正确的测试用例
