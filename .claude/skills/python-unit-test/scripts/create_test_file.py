#!/usr/bin/env python3
"""
创建测试文件脚本

根据被测试的源文件路径，创建对应的测试文件。
测试文件将保持与源文件相同的目录结构，但位于 test/ 目录下。
test/ 目录与 src/ 目录平级。

此脚本还会自动处理导入配置问题：
- 创建 src/ 及其子目录的 __init__.py
- 创建 test/conftest.py
- 删除 test/ 子目录中的 __init__.py（避免导入冲突）
- 检查并创建 pyproject.toml（如果不存在）
- 安装项目为可编辑包
- 安装必要的测试依赖

目录结构示例：
    backend/
    ├── src/
    │   ├── __init__.py
    │   └── app/
    │       ├── __init__.py
    │       └── models/
    │           ├── __init__.py
    │           └── user.py
    ├── test/
    │   ├── conftest.py
    │   └── app/
    │       └── models/
    │           └── test_user.py  # 无 __init__.py
    └── pyproject.toml

测试文件命名格式：test_<源文件名>.py

用法：
    python create_test_file.py <源文件路径> [项目根目录]

示例：
    python create_test_file.py backend/src/app/models/user.py
    python create_test_file.py backend/src/app/models/user.py /path/to/project
"""

import os
import sys
import subprocess
from pathlib import Path


def check_and_install_pytest() -> bool:
    """
    检查 pytest 是否已安装，如果未安装则自动安装

    Returns:
        bool: pytest 是否可用
    """
    # 首先检查 pytest 是否已安装
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print(f"✓ pytest 已安装: {result.stdout.strip()}")
            return True
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # pytest 未安装，尝试安装
    print("⚠ pytest 未安装，正在自动安装...")
    try:
        # 安装 pytest、pytest-cov 和 pytest-mock
        print("正在安装: pytest pytest-cov pytest-mock")
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "pytest", "pytest-cov", "pytest-mock"],
            capture_output=True,
            text=True,
            timeout=300  # 5分钟超时
        )

        if result.returncode == 0:
            print("✓ pytest 安装成功")

            # 验证安装
            verify_result = subprocess.run(
                [sys.executable, "-m", "pytest", "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if verify_result.returncode == 0:
                print(f"✓ pytest 验证成功: {verify_result.stdout.strip()}")
                return True
            else:
                print("✗ pytest 安装验证失败")
                return False
        else:
            print(f"✗ pytest 安装失败:")
            print(result.stderr)
            return False

    except subprocess.TimeoutExpired:
        print("✗ pytest 安装超时（超过5分钟）")
        return False
    except Exception as e:
        print(f"✗ pytest 安装出错: {e}")
        return False


def setup_project_environment(project_root: Path) -> bool:
    """
    设置项目环境，处理导入配置问题

    Args:
        project_root: 项目根目录

    Returns:
        bool: 是否成功设置
    """
    print("=" * 60)
    print("检查项目配置...")
    print("=" * 60)

    success = True

    # 1. 检查并创建 pyproject.toml
    pyproject_toml = project_root / "pyproject.toml"
    if not pyproject_toml.exists():
        print("⚠ 未找到 pyproject.toml，正在创建...")
        pyproject_content = '''[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "your-project-name"
version = "0.1.0"
description = "Your project description"
requires-python = ">=3.12"
license = {text = "MIT"}

[tool.setuptools.packages.find]
where = ["src"]

[tool.setuptools.package-dir]
"" = "src"

[tool.pytest.ini_options]
testpaths = ["test"]
pythonpath = ["src"]
asyncio_mode = "auto"
markers = [
    "asyncio: mark test as an async test"
]
'''
        pyproject_toml.write_text(pyproject_content, encoding="utf-8")
        print(f"✓ 已创建 pyproject.toml")
        print("  ⚠ 请手动更新项目名称和描述")
    else:
        print("✓ pyproject.toml 已存在")

    # 2. 检查 src/ 目录
    src_dir = project_root / "src"
    if src_dir.exists():
        print("✓ src/ 目录存在")

        # 创建 src/__init__.py
        src_init = src_dir / "__init__.py"
        if not src_init.exists():
            src_init.write_text("# SkillHub package\n", encoding="utf-8")
            print("✓ 已创建 src/__init__.py")

        # 创建所有子目录的 __init__.py
        for item in src_dir.rglob("*"):
            if item.is_dir() and item != src_dir:
                init_file = item / "__init__.py"
                if not init_file.exists():
                    init_file.write_text("# Package\n", encoding="utf-8")
                    print(f"✓ 已创建 {item.relative_to(project_root)}/__init__.py")
    else:
        print("⚠ src/ 目录不存在，跳过 __init__.py 创建")

    # 3. 检查并创建 test/conftest.py
    test_dir = project_root / "test"
    if test_dir.exists():
        print("✓ test/ 目录存在")

        conftest_file = test_dir / "conftest.py"
        if not conftest_file.exists():
            conftest_content = '''"""
pytest 配置文件
统一配置测试环境
"""

import sys
from pathlib import Path


def pytest_configure():
    """
    pytest 配置钩子，在最开始执行
    设置 Python 路径以便正确导入模块
    """
    # conftest.py 位于 test/，需要向上一级到项目根目录，然后进入 src/
    current_dir = Path(__file__).resolve().parent
    project_root = current_dir.parent  # 向上一级到项目根目录
    src_path = project_root / "src"

    # 移除可能存在的 test 目录
    test_path = str(current_dir)
    if test_path in sys.path:
        sys.path.remove(test_path)

    # 确保 src 路径在 sys.path 的最前面
    src_path_str = str(src_path)
    if src_path_str in sys.path:
        sys.path.remove(src_path_str)
    sys.path.insert(0, src_path_str)

    print(f"DEBUG: Configured sys.path")
    print(f"DEBUG: sys.path[:3] = {sys.path[:3]}")
'''
            conftest_file.write_text(conftest_content, encoding="utf-8")
            print("✓ 已创建 test/conftest.py")
        else:
            print("✓ test/conftest.py 已存在")

        # 4. 删除 test/ 子目录中的 __init__.py（避免导入冲突）
        init_files = list(test_dir.rglob("__init__.py"))
        if init_files:
            print(f"⚠ 发现 {len(init_files)} 个 test/ 子目录中的 __init__.py 文件")
            for init_file in init_files:
                try:
                    init_file.unlink()
                    print(f"✓ 已删除 {init_file.relative_to(project_root)}（避免导入冲突）")
                except Exception as e:
                    print(f"✗ 删除 {init_file.relative_to(project_root)} 失败: {e}")
                    success = False
        else:
            print("✓ test/ 子目录中无 __init__.py 文件")

    else:
        print("⚠ test/ 目录不存在，将自动创建")

    # 5. 安装项目为可编辑包
    print("\n检查项目安装状态...")
    try:
        # 这里应该检查实际的项目名称，但我们无法从 pyproject.toml 轻松获取
        # 所以我们直接尝试安装
        print("⚠ 尝试安装项目为可编辑包...")
        print("  运行: pip install -e .")
        install_result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-e", str(project_root)],
            capture_output=True,
            text=True,
            timeout=120
        )
        if install_result.returncode == 0:
            print("✓ 项目已安装为可编辑包")
        else:
            # 可能已经安装了
            if "Requirement already satisfied" in install_result.stdout:
                print("✓ 项目已安装为可编辑包")
            else:
                print(f"⚠ 安装可能有问题: {install_result.stderr}")
    except Exception as e:
        print(f"⚠ 安装检查失败: {e}")

    # 6. 检查并安装 pytest-asyncio
    print("\n检查 pytest-asyncio...")
    try:
        # 检查是否安装了 pytest-asyncio
        import_result = subprocess.run(
            [sys.executable, "-c", "import pytest_asyncio"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if import_result.returncode != 0:
            print("⚠ pytest-asyncio 未安装，正在安装...")
            install_result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "pytest-asyncio"],
                capture_output=True,
                text=True,
                timeout=60
            )
            if install_result.returncode == 0:
                print("✓ pytest-asyncio 安装成功")
            else:
                print(f"✗ pytest-asyncio 安装失败: {install_result.stderr}")
                success = False
        else:
            print("✓ pytest-asyncio 已安装")
    except Exception as e:
        print(f"⚠ pytest-asyncio 检查失败: {e}")

    print("=" * 60)
    return success


def create_test_file(source_file: str, project_root: str = None) -> dict:
    """
    创建测试文件

    Args:
        source_file: 源文件路径（相对或绝对路径）
        project_root: 项目根目录（可选）

    Returns:
        dict: 包含创建结果的字典
            - success: bool
            - test_file_path: str
            - message: str
    """
    source_path = Path(source_file).resolve()

    # 验证源文件存在
    if not source_path.exists():
        return {
            "success": False,
            "test_file_path": None,
            "message": f"源文件不存在: {source_file}"
        }

    if not source_path.suffix == ".py":
        return {
            "success": False,
            "test_file_path": None,
            "message": f"源文件不是 Python 文件: {source_file}"
        }

    # 确定项目根目录和测试根目录
    if project_root:
        root_path = Path(project_root).resolve()
        # 检查是否指定了 test_root
        if (root_path / "test").exists():
            test_root = root_path / "test"
        elif (root_path / "tests").exists():
            test_root = root_path / "tests"
        else:
            # 如果都不存在，假设 test 目录和 src 平级
            test_root = root_path / "test"
    else:
        # 如果没有指定，尝试查找项目根目录
        # 向上查找，直到找到包含 src/ 或 backend/ 或 frontend/ 的目录
        current = source_path.parent
        while current != current.parent:
            if (current / "src").exists() or (current / "backend").exists() or (current / "frontend").exists():
                root_path = current
                break
            current = current.parent
        else:
            # 如果没找到，使用源文件的父目录的父目录
            root_path = source_path.parent.parent

        # 确定测试根目录：test 目录和 src 平级
        if (root_path / "test").exists():
            test_root = root_path / "test"
        elif (root_path / "tests").exists():
            test_root = root_path / "tests"
        else:
            # 默认使用 test 目录（和 src 平级）
            test_root = root_path / "test"

    # 计算源文件相对于项目根目录的路径
    try:
        relative_path = source_path.relative_to(root_path)
    except ValueError:
        # 如果源文件不在项目根目录下，使用其完整路径
        relative_path = source_path
        # 此时使用源文件的父目录作为测试根目录
        test_root = source_path.parent.parent / "test"

    # 创建测试目录结构：test/<原目录结构>
    # 如果源文件在 src/ 下，则保持相同的相对路径结构
    if "src" in relative_path.parts:
        # 去掉 src 部分，保持其他路径结构
        parts = list(relative_path.parts)
        src_index = parts.index("src")
        test_relative_parts = parts[src_index + 1:]  # 跳过 src
        test_dir = test_root / Path(*test_relative_parts).parent
    else:
        # 不在 src 下，直接使用原有相对路径
        test_dir = test_root / relative_path.parent

    # 创建测试文件名：test_<原文件名>
    test_filename = f"test_{source_path.stem}.py"
    test_file_path = test_dir / test_filename

    # 如果测试文件已存在，询问是否覆盖
    if test_file_path.exists():
        return {
            "success": False,
            "test_file_path": str(test_file_path),
            "message": f"测试文件已存在: {test_file_path}"
        }

    # 创建目录
    test_dir.mkdir(parents=True, exist_ok=True)

    # ⚠️ 不创建 __init__.py，由 setup_project_environment 统一处理
    # test/ 子目录中的 __init__.py 会导致导入冲突

    # 创建测试文件模板
    # 生成正确的导入路径
    module_path = str(relative_path.with_suffix('')).replace(os.sep, '.')

    test_content = f'''"""
{source_path.stem} 的单元测试

自动生成的测试文件模板
"""

import pytest
# 导入被测试的模块
# 注意：根据项目结构，可能需要调整导入路径
# 示例：from {module_path} import your_function


class Test{source_path.stem.capitalize().replace('_', '')}:
    """测试 {source_path.stem}"""

    def test_example(self):
        """示例测试用例"""
        # TODO: 在这里添加你的测试代码
        assert True

    # TODO: 添加更多测试用例
'''

    # 写入测试文件
    test_file_path.write_text(test_content, encoding="utf-8")

    return {
        "success": True,
        "test_file_path": str(test_file_path),
        "message": f"测试文件已创建: {test_file_path}",
        "source_file": str(source_path),
        "relative_path": str(relative_path),
        "test_dir": str(test_dir),
        "module_path": module_path
    }


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print("用法: python create_test_file.py <源文件路径> [项目根目录]")
        print("\n示例:")
        print("  python create_test_file.py backend/src/app/models/user.py")
        print("  python create_test_file.py backend/src/app/models/user.py /path/to/project")
        print("\n注意: 测试文件将创建在与 src/ 平级的 test/ 目录下")
        print("此脚本还会自动配置项目环境（pyproject.toml、__init__.py、conftest.py 等）")
        sys.exit(1)

    source_file = sys.argv[1]
    project_root_arg = sys.argv[2] if len(sys.argv) > 2 else None

    # 首先确定项目根目录
    source_path = Path(source_file).resolve()
    if project_root_arg:
        project_root = Path(project_root_arg).resolve()
    else:
        # 自动查找项目根目录
        current = source_path.parent
        while current != current.parent:
            if (current / "src").exists() or (current / "backend").exists():
                project_root = current
                break
            current = current.parent
        else:
            # 如果没找到，使用源文件的祖父目录
            project_root = source_path.parent.parent

    # 1. 检查并安装 pytest
    print("=" * 60)
    print("检查 pytest 环境...")
    print("=" * 60)
    if not check_and_install_pytest():
        print("\n✗ 无法安装 pytest，请手动安装:")
        print("  pip install pytest pytest-cov pytest-mock")
        sys.exit(1)
    print("=" * 60)
    print()

    # 2. 设置项目环境（创建配置文件、__init__.py 等）
    if not setup_project_environment(project_root):
        print("\n⚠ 项目环境配置可能有问题，但继续创建测试文件...")

    print()

    # 3. 创建测试文件
    result = create_test_file(source_file, str(project_root))

    if result["success"]:
        print(f"✓ {result['message']}")
        print(f"\n源文件: {result.get('source_file', 'N/A')}")
        print(f"测试文件: {result['test_file_path']}")
        print(f"\n模块路径示例:")
        print(f"  {result.get('module_path', 'N/A')}")
        print("\n下一步:")
        print("  1. 在测试文件中添加测试用例")
        print("  2. 运行: pytest " + str(result['test_file_path']))
    else:
        print(f"✗ {result['message']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
