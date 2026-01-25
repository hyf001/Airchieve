"""Claude Agent provider implementation.

Merged from base_agent.py and aircheve_agent.py.
"""
from __future__ import annotations

from datetime import datetime
from shutil import which
from traceback import format_exc
from typing import Any, AsyncGenerator

from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

from app.core.chat_context import ChatContext
from app.core.utils.terminal_ui import ui
from app.core.ChatMessage import ChatMessage
from app.core.utils import prompt_util
from app.core.message_handler import handle_message
from claude_agent_sdk.types import ResultMessage


class AirchieveAgent:
    """Claude Agent Python SDK implementation"""

    def init_claude_option(self, chat_context: ChatContext) -> ClaudeAgentOptions:
        """connect and return Claude Agent SDK client"""

        
        system_prompt = prompt_util.getSystemPrompt(project_path=chat_context.get_project_path())

        # Get CLI-specific model name
        cli_model = "claude-sonnet-4-5-20250929" if chat_context.model is None else chat_context.model

        # Configure hooks
        hooks = self._get_hooks_config()

        # 基础环境变量
        env_config = {
            "NODE_TLS_REJECT_UNAUTHORIZED": "0"
        }

        # 🔑 使用预先获取的用户配置
        if chat_context.user_config:
            env_config.update(chat_context.user_config)
            ui.info("Using user-specific Anthropic config", "User Config")
        else:
            ui.info("Using system default Anthropic config", "User Config")

        # If force_new_session is True (from /clear command), disable continue_conversation
        # and don't use resume, ensuring a completely fresh session
        force_new_session = chat_context.instruction == '/clear'
        options = ClaudeAgentOptions(
                system_prompt=system_prompt,
                model=cli_model,
                continue_conversation=not force_new_session,  # Disable if forcing new session
                setting_sources=["project", "local"],
                cwd=chat_context.get_project_path(),
                env=env_config,  # 使用包含用户配置的环境变量
                hooks=hooks,  # 添加 Hook 配置
                disallowed_tools=["ExitPlanMode"],
                allowed_tools = ["Read", "Bash", "Glob", "Grep", "LS", "WebFetch", "WebSearch", "TodoWrite", "Write", "Edit",
                         "MultiEdit", "mcp__html_validator__validate_html", "Skill"],
                # 配置权限模式
                permission_mode = "bypassPermissions",
                # agents={"double_check_ui_generator":sub_agents.create_ui_agent()}
            )

        return options

    async def execute_with_streaming(
        self,
        chat_context: 'ChatContext'
    ) -> AsyncGenerator[ChatMessage, None]:
        """使用 Claude Agent Python SDK 执行指令

        Args:
            chat_context: 聊天上下文，封装所有执行参数
        """

        # 优化：添加错误追踪变量
        last_message_type = None
        last_message_time = None
        received_end_signal = False
        message_count = 0

        ui.info(f"开始执行 (项目: {chat_context.project_id})", "Claude Agent SDK")

        # 处理文件（如果有提供）
        processed_instruction = chat_context.instruction
        if chat_context.files and len(chat_context.files) > 0:
            file_refs = []
            for i, file in enumerate(chat_context.files):
                if file.path:
                    file_refs.append(f"文件 #{i+1}: {file.path}")
                elif file.name:
                    file_refs.append(f"文件 #{i+1}: {file.name}")

            if file_refs:
                processed_instruction = f"{chat_context.instruction}\n\n文件:\n{chr(10).join(file_refs)}"
                ui.info(f"已处理 {len(file_refs)} 个文件", "Claude Agent SDK")

        options = self.init_claude_option(chat_context)
        
        
        try:
            async with ClaudeSDKClient(options=options) as client:
                self.cli = client
                await self.cli.query(processed_instruction)
                async for message_obj in self.cli.receive_messages():
                    message_count += 1
                    current_time = datetime.utcnow()

                    # 使用新的 handle_message 处理消息
                    messages = handle_message(message_obj, chat_context)

                    # yield 所有处理后的消息
                    for msg in messages:
                        yield msg

                    # 检查是否为 ResultMessage（会话结束）
                    if isinstance(message_obj, ResultMessage) or "ResultMessage" in str(type(message_obj)):
                        ui.info("会话完成", "Claude Agent SDK")
                        return  # 立即退出生成器函数

        except Exception as fatal_error:
            error_type = type(fatal_error).__name__
            error_message = str(fatal_error)

            ui.error(f"执行错误: {error_type}: {error_message}", "Claude Agent SDK")

            # 创建并返回错误消息
            error_msg = ChatMessage(
                role="system",
                message_type="error",
                content=error_message,
                metadata_json={
                    "mode": "SDK",
                    "error_type": "cli_process_error",
                    "error_class": error_type,
                    "message_count": message_count,
                    "last_message_type": last_message_type,
                    "last_message_time": str(last_message_time) if last_message_time else None,
                    "traceback": format_exc(),
                    "hidden_from_ui": False,
                },
                conversation_id=chat_context.project_id,
                duration_ms=0,
                token_count=0,
                cost_usd=None,
                created_at=datetime.utcnow(),
            )
            yield error_msg

            return

    def _get_hooks_config(self):
        """获取 hooks 配置 """
        return None

    def get_mcp_servers(self):
        """获取 MCP 服务器配置 """
        return None

    def _get_hook_context(self):
        """获取 hook 上下文 """
        return None
