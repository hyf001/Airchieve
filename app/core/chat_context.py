"""
Chat Context - 为聊天执行提供上下文信息.

这个模块包含：
1. ChatContext: execute_with_streaming 的参数封装
2. HookContext: Hook 系统的上下文封装
"""

import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from claude_agent_sdk import PermissionMode

from app.core.config import settings
from app.schemas.media import FileInfo


@dataclass
class ChatContext:
    """聊天上下文类 - 封装 execute_with_streaming 需要的所有信息

    这个类将原本的多个参数组织成清晰的结构，便于扩展和维护。
    """

    # ========== 核心必需参数 ==========
    instruction: str  # 用户指令
    project_id: str  # 项目ID（同时作为会话标识）

    # ========== 会话管理 ==========
    claude_session_id: Optional[str] = None  # Claude SDK 会话ID（用于会话恢复）
    sub_agent_name: Optional[str] = None  # 子Agent名称（多Agent场景）

    # ========== 模型与执行配置 ==========
    model: Optional[str] = None  # 模型名称
    cli_binary: Optional[str] = None  # CLI 二进制文件路径
    permission_mode: PermissionMode = "default"  # 权限模式

    # ========== 用户信息与配置 ==========
    cert_fingerprint: Optional[str] = None  # 用户证书指纹（用于获取用户配置）
    user_config: Optional[Dict[str, str]] = None  # 用户自定义配置

    # ========== 文件列表 ==========
    files: Optional[List[FileInfo]] = None  # 文件列表

    # ========== 状态标志 ==========
    is_initial_prompt: bool = False  # 是否为初始提示（影响会话初始化）
    is_continue_session: bool = False  # 是否继续已有会话

    # ========== 中断控制 ==========
    interrupt_context: Optional[Any] = None  # 中断检查上下文（用于支持会话中断）

    def __post_init__(self):
        """数据验证"""
        if not self.instruction:
            raise ValueError("instruction 不能为空")
        if not self.project_id:
            raise ValueError("project_id 不能为空")

    def get_project_path(self) -> str:
        """获取用户项目完整路径"""
        return os.path.join(settings.USER_PROJECTS_ROOT, self.project_id)
        
    

