import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# 为测试提供稳定的基础配置，避免本机环境变量影响模块导入。
os.environ["DEBUG"] = "false"
