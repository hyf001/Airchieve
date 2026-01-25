"""
消息处理器 - 将 Claude Agent SDK 消息转换为 ChatMessage

处理以下消息类型:
- AssistantMessage: 助手回复（文本、工具调用）
- UserMessage: 用户消息（工具结果）
- SystemMessage: 系统消息（会话初始化、命令输出）
- ResultMessage: 结果消息（会话完成、指标统计）
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, cast

from claude_agent_sdk.types import (
    AssistantMessage,
    UserMessage,
    SystemMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock
)

from app.core.ChatMessage import ChatMessage
from app.core.chat_context import ChatContext


# ============================================================================
# 主处理函数
# ============================================================================

def handle_message(sdk_message: Any, context: ChatContext) -> List[ChatMessage]:
    """处理 SDK 消息，返回 ChatMessage 列表。

    Args:
        sdk_message: Claude Agent SDK 消息对象（AssistantMessage, UserMessage, SystemMessage, ResultMessage 等）
        context: 聊天上下文（包含 project_id 等信息，便于扩展）

    Returns:
        ChatMessage 列表（对于不支持的消息类型返回空列表）
    """
    conversation_id = context.project_id

    if isinstance(sdk_message, AssistantMessage) or "AssistantMessage" in str(type(sdk_message)):
        return handle_assistant_message(cast(AssistantMessage, sdk_message), conversation_id)
    elif isinstance(sdk_message, UserMessage) or "UserMessage" in str(type(sdk_message)):
        return handle_user_message(cast(UserMessage, sdk_message), conversation_id)
    elif isinstance(sdk_message, SystemMessage) or "SystemMessage" in str(type(sdk_message)):
        return handle_system_message(cast(SystemMessage, sdk_message), conversation_id)
    elif isinstance(sdk_message, ResultMessage) or "ResultMessage" in str(type(sdk_message)):
        return handle_result_message(cast(ResultMessage, sdk_message), conversation_id)
    else:
        # 其他消息类型（如 StreamEvent）不处理
        return []


# ============================================================================
# AssistantMessage 处理
# ============================================================================

def handle_assistant_message(message: AssistantMessage, conversation_id: str) -> List[ChatMessage]:
    """处理 AssistantMessage，提取文本和工具调用。

    Args:
        message: AssistantMessage 对象
        conversation_id: 会话 ID

    Returns:
        ChatMessage 列表（文本消息 + 工具调用消息）
    """
    messages = []
    text_content = ""

    if not hasattr(message, "content") or not isinstance(message.content, list):
        return messages

    model = getattr(message, "model", None)

    for block in message.content:
        if isinstance(block, TextBlock):
            text_content += block.text
        elif isinstance(block, ToolUseBlock):
            tool_msg = _create_tool_use_message(block, conversation_id)
            messages.append(tool_msg)

    # 添加文本消息
    if text_content and text_content.strip():
        text_msg = _create_text_message(text_content, conversation_id, model)
        messages.append(text_msg)

    return messages


def _create_text_message(content: str, conversation_id: str, model: str | None = None) -> ChatMessage:
    """创建文本消息。"""
    metadata = {"mode": "SDK"}
    if model and model not in ["<synthetic>", "<error>", "<unknown>"]:
        metadata["model"] = model

    return ChatMessage(
        role="assistant",
        message_type="chat",
        content=content.strip(),
        metadata_json=metadata,
        conversation_id=conversation_id,
        duration_ms=0,
        token_count=0,
        cost_usd=None,
        created_at=datetime.now(timezone.utc),
    )


def _create_tool_use_message(block: ToolUseBlock, conversation_id: str) -> ChatMessage:
    """创建工具调用消息。"""
    tool_name = block.name
    tool_input = block.input
    tool_id = block.id

    summary = _create_tool_summary(tool_name, tool_input)

    return ChatMessage(
        role="assistant",
        message_type="tool_use",
        content=summary,
        metadata_json={
            "mode": "SDK",
            "tool_name": tool_name,
            "tool_input": tool_input,
            "tool_id": tool_id,
        },
        conversation_id=conversation_id,
        duration_ms=0,
        token_count=0,
        cost_usd=None,
        created_at=datetime.now(timezone.utc),
    )


# ============================================================================
# UserMessage 处理
# ============================================================================

def handle_user_message(message: UserMessage, conversation_id: str) -> List[ChatMessage]:
    """处理 UserMessage，提取工具结果和命令输出。

    Args:
        message: UserMessage 对象
        conversation_id: 会话 ID

    Returns:
        ChatMessage 列表
    """
    raw_content = getattr(message, "content", "")
    messages: List[ChatMessage] = []

    # 提取文本内容
    content = _extract_text_content(raw_content)

    # 处理 slash 命令输出
    if content and "<local-command-stdout>" in content:
        cmd_message = _handle_slash_command_output(content, conversation_id)
        if cmd_message:
            messages.append(cmd_message)

    # 处理 ToolResultBlock
    if isinstance(raw_content, list):
        for block in raw_content:
            if isinstance(block, ToolResultBlock) or "ToolResultBlock" in str(type(block)):
                result_msg = _process_tool_result(block, conversation_id)
                if result_msg:
                    messages.append(result_msg)

    return messages


def _process_tool_result(block: Any, conversation_id: str) -> ChatMessage | None:
    """处理单个 ToolResultBlock。"""
    try:
        tool_use_id = getattr(block, "tool_use_id", None)
        result_content = getattr(block, "content", "")
        is_error = getattr(block, "is_error", False)

        # 转换内容为字符串
        if isinstance(result_content, list):
            content_str = _extract_text_content(result_content)
        else:
            content_str = str(result_content) if result_content else ""

        # 确定状态
        if "blocked" in content_str.lower():
            status = "blocked"
        elif is_error:
            status = "error"
        else:
            status = "success"

        return ChatMessage(
            role="user",
            message_type="tool_result",
            content=content_str,
            metadata_json={
                "mode": "SDK",
                "subtype": "tool_result",
                "tool_use_id": tool_use_id,
                "is_error": is_error,
                "status": status,
            },
            conversation_id=conversation_id,
            duration_ms=0,
            token_count=0,
            cost_usd=None,
            created_at=datetime.now(timezone.utc),
        )
    except Exception:
        return None


def _handle_slash_command_output(content: str, conversation_id: str) -> ChatMessage | None:
    """处理 slash 命令输出。"""
    match = re.search(
        r'<local-command-stdout>(.*?)</local-command-stdout>',
        content,
        re.DOTALL
    )

    if not match:
        return None

    command_output = match.group(1).strip()

    # 检测命令类型
    if "## Context Usage" in command_output:
        command_type = "context"
    elif "## Status" in command_output or "Claude Code" in command_output:
        command_type = "status"
    else:
        command_type = "unknown"

    return ChatMessage(
        role="system",
        message_type="system",
        content=command_output,
        metadata_json={
            "mode": "SDK",
            "subtype": "slash_command_output",
            "command": command_type,
        },
        conversation_id=conversation_id,
        duration_ms=0,
        token_count=0,
        cost_usd=None,
        created_at=datetime.now(timezone.utc),
    )


def _extract_text_content(content: Any) -> str:
    """从内容中提取文本。"""
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for block in content:
            if isinstance(block, TextBlock):
                text_parts.append(block.text)
            elif isinstance(block, dict) and block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif isinstance(block, str):
                text_parts.append(block)
        return "".join(text_parts)

    return str(content) if content else ""


# ============================================================================
# SystemMessage 处理
# ============================================================================

def handle_system_message(message: SystemMessage, conversation_id: str) -> List[ChatMessage]:
    """处理 SystemMessage，提取系统信息。

    Args:
        message: SystemMessage 对象
        conversation_id: 会话 ID

    Returns:
        ChatMessage 列表
    """
    messages = []
    subtype = getattr(message, "subtype", None)

    # 处理 /clear 命令
    if subtype == "init":
        messages.append(_create_init_message(message, conversation_id, subtype))

    # 处理 /compact 命令
    elif subtype == "compact_boundary":
        messages.append(_create_compact_message(message, conversation_id))

    else:
        # 其他系统消息
        messages.append(_create_init_message(message, conversation_id, subtype))

    return messages


def _create_init_message(message: Any, conversation_id: str, subtype: str | None) -> ChatMessage:
    """创建初始化消息。"""
    session_id = None
    if hasattr(message, "data") and isinstance(message.data, dict):
        session_id = message.data.get("session_id")

    return ChatMessage(
        role="system",
        message_type="system",
        content=f"Session initialized",
        metadata_json={
            "mode": "SDK",
            "session_id": session_id or getattr(message, "session_id", None),
            "subtype": subtype,
            "hidden_from_ui": True,
        },
        conversation_id=conversation_id,
        duration_ms=0,
        token_count=0,
        cost_usd=None,
        created_at=datetime.now(timezone.utc),
    )


def _create_compact_message(message: Any, conversation_id: str) -> ChatMessage:
    """创建 compact 消息。"""
    compact_metadata = getattr(message, "compact_metadata", {})

    if not isinstance(compact_metadata, dict) and compact_metadata:
        compact_metadata = {
            "pre_tokens": getattr(compact_metadata, "pre_tokens", 0),
            "post_tokens": getattr(compact_metadata, "post_tokens", 0),
            "trigger": getattr(compact_metadata, "trigger", "manual"),
        }

    pre_tokens = compact_metadata.get("pre_tokens", 0)
    post_tokens = compact_metadata.get("post_tokens", 0)

    if post_tokens > 0:
        saved_tokens = pre_tokens - post_tokens
        content = (
            f"🗜️ 对话历史已压缩\n\n"
            f"• 压缩前：{pre_tokens:,} tokens\n"
            f"• 压缩后：{post_tokens:,} tokens\n"
            f"• 节省：{saved_tokens:,} tokens"
        )
    else:
        content = f"🗜️ 对话历史已压缩（{pre_tokens:,} tokens）"

    return ChatMessage(
        role="system",
        message_type="system",
        content=content,
        metadata_json={
            "mode": "SDK",
            "subtype": "compact_boundary",
            "command": "compact",
            "compact_metadata": compact_metadata,
        },
        conversation_id=conversation_id,
        duration_ms=0,
        token_count=0,
        cost_usd=None,
        created_at=datetime.now(timezone.utc),
    )


# ============================================================================
# ResultMessage 处理
# ============================================================================

def handle_result_message(message: ResultMessage, conversation_id: str) -> List[ChatMessage]:
    """处理 ResultMessage，提取会话完成信息。

    Args:
        message: ResultMessage 对象
        conversation_id: 会话 ID

    Returns:
        ChatMessage 列表
    """
    result_text = getattr(message, 'result', None)
    is_error = getattr(message, 'is_error', False)

    # 提取指标
    duration_ms = getattr(message, 'duration_ms', 0)
    duration_api_ms = getattr(message, 'duration_api_ms', 0)
    total_cost_usd = getattr(message, 'total_cost_usd', 0)
    num_turns = getattr(message, 'num_turns', 0)
    usage = getattr(message, 'usage', None)

    # 序列化 usage
    usage_dict = _serialize_usage(usage)
    total_tokens = usage_dict.get('input_tokens', 0) + usage_dict.get('output_tokens', 0)

    # 格式化内容
    content = _format_result_content(duration_ms, total_tokens, num_turns, total_cost_usd, is_error)

    return [ChatMessage(
        role="system",
        message_type="chat_complete",
        content=content,
        metadata_json={
            "mode": "SDK",
            "duration_ms": duration_ms,
            "duration_api_ms": duration_api_ms,
            "total_cost_usd": total_cost_usd,
            "usage": usage_dict,
            "num_turns": num_turns,
            "is_error": is_error,
            "error_text": result_text if is_error else None,
        },
        conversation_id=conversation_id,
        duration_ms=int(duration_ms),
        token_count=total_tokens,
        cost_usd=total_cost_usd,
        created_at=datetime.now(timezone.utc),
    )]


def _format_result_content(
    duration_ms: float,
    total_tokens: int,
    num_turns: int,
    total_cost_usd: float,
    is_error: bool = False
) -> str:
    """格式化会话完成内容。"""
    duration_str = _format_duration(duration_ms)

    if is_error:
        result_parts = [f"⚠️会话异常结束，⏱️耗时 {duration_str}"]
    else:
        result_parts = [f"🎉会话完成，⏱️耗时 {duration_str}"]

    if total_tokens > 0:
        result_parts.append(f"📊Token: {total_tokens:,}")

    if num_turns > 0:
        result_parts.append(f"🔄轮次: {num_turns}")

    if total_cost_usd and total_cost_usd > 0:
        result_parts.append(f"💰费用: ${total_cost_usd:.4f}")

    return " | ".join(result_parts)


def _format_duration(duration_ms: float) -> str:
    """格式化时长。"""
    if duration_ms >= 1000:
        seconds = duration_ms / 1000
        if seconds >= 60:
            minutes = int(seconds // 60)
            remaining_seconds = seconds % 60
            return f"{minutes}m {remaining_seconds:.1f}s"
        return f"{seconds:.2f}s"
    return f"{int(duration_ms)}ms"


def _serialize_usage(usage: Any) -> Dict[str, Any]:
    """序列化 usage 对象。"""
    if usage is None:
        return {}

    try:
        if hasattr(usage, '__dict__'):
            return {
                'input_tokens': getattr(usage, 'input_tokens', 0),
                'output_tokens': getattr(usage, 'output_tokens', 0),
                'cache_read_input_tokens': getattr(usage, 'cache_read_input_tokens', 0),
                'cache_creation_input_tokens': getattr(usage, 'cache_creation_input_tokens', 0),
            }
        elif isinstance(usage, dict):
            return usage
    except Exception:
        pass

    return {"raw": str(usage)}


# ============================================================================
# 工具摘要辅助函数
# ============================================================================

def _normalize_tool_name(tool_name: str) -> str:
    """统一工具名称。"""
    key = (tool_name or "").strip()
    key_lower = key.replace(" ", "").lower()
    tool_mapping = {
        "read_file": "Read", "read": "Read", "readfile": "Read",
        "write_file": "Write", "write": "Write", "writefile": "Write",
        "edit_file": "Edit", "replace": "Edit", "edit": "Edit",
        "readfolder": "LS", "list_directory": "LS", "ls": "LS",
        "findfiles": "Glob", "find_files": "Glob", "glob": "Glob",
        "searchtext": "Grep", "grep": "Grep", "search": "Grep",
        "shell": "Bash", "run_terminal_command": "Bash", "bash": "Bash",
        "web_search": "WebSearch", "websearch": "WebSearch",
        "web_fetch": "WebFetch", "webfetch": "WebFetch",
    }
    return tool_mapping.get(tool_name, tool_mapping.get(key_lower, key))


def _create_tool_summary(tool_name: str, tool_input: Dict[str, Any]) -> str:
    """创建工具摘要。"""
    normalized = _normalize_tool_name(tool_name)

    def get_path(keys=("file_path", "path", "file")):
        for k in keys:
            if v := tool_input.get(k):
                return v
        return ""

    if normalized == "Edit":
        return f"📝 **Edit** `{get_path() or 'file'}`"
    elif normalized == "Read":
        return f"📖 **Read** `{get_path() or 'file'}`"
    elif normalized == "Write":
        return f"✏️ **Write** `{get_path() or 'file'}`"
    elif normalized == "Bash":
        cmd = tool_input.get("command") or tool_input.get("cmd", "command")
        return f"**Bash** `{cmd}`"
    elif normalized == "LS":
        path = tool_input.get("path") or tool_input.get("directory", ".")
        return f"📁 **LS** `{path}`"
    elif normalized == "Glob":
        pattern = tool_input.get("pattern", "")
        return f"🔎 **Glob** `{pattern or 'pattern'}`"
    elif normalized == "Grep":
        pattern = tool_input.get("pattern") or tool_input.get("query", "")
        return f"🔍 **Search** `{pattern}`"
    elif normalized == "WebSearch":
        return f"🌐 **WebSearch** `{tool_input.get('query', 'query')}`"
    elif normalized == "WebFetch":
        if url := tool_input.get("url"):
            domain = url.split("//")[-1].split("/")[0] if "//" in url else url.split("/")[0]
            return f"🌐 **WebFetch** `{domain}`"
        return "🌐 **WebFetch** `url`"
    elif normalized == "TodoWrite":
        todos = tool_input.get("todos", [])
        if todos:
            total = len(todos)
            completed = len([t for t in todos if t.get("status") == "completed"])
            in_progress = len([t for t in todos if t.get("status") == "in_progress"])
            lines = [f"**Todo List ({completed}/{total} completed)**"]
            for i, todo in enumerate(todos):
                status = todo.get("status", "pending")
                icon = "✅" if status == "completed" else "🔧" if status == "in_progress" else "⏳"
                text = todo.get("activeForm") if status == "in_progress" else todo.get("content", "")
                lines.append(f"{i + 1}. {icon} {text}")
            return "\n".join(lines)
        return "📋 **TodoWrite** `planning`"
    elif normalized == "Task":
        desc = tool_input.get("description", "")
        return f"🤖 **Task** `{desc or 'subtask'}`"
    else:
        return f"**{tool_name}** `executing...`"
