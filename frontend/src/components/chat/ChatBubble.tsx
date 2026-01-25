import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileCode,
  Terminal,
  Eye,
  Pencil,
  Check,
  Globe,
  FolderOpen,
  Search,
  FileText,
  Zap
} from 'lucide-react';
import type { Message, ChatStreamMessage } from '@/lib/api';

interface ChatBubbleProps {
  message: Message | ChatStreamMessage;
  isStreaming?: boolean;
}

/**
 * 聊天消息气泡组件
 *
 * 消息类型 (MessageType):
 * - project_created: 项目创建通知
 * - system: 系统消息（可能隐藏）
 * - chat: 普通对话消息
 * - thinking: 可折叠的思考过程
 * - tool_use: 工具执行指示器
 * - tool_result: 工具结果（可折叠）
 * - chat_complete: 会话完成指示器
 * - error: 错误消息
 */
export function ChatBubble({ message }: ChatBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const messageType = message.message_type;
  const role = message.role;
  const metadata = message.metadata_json as Record<string, unknown> | undefined;

  // ========== project_created 消息 ==========
  if (messageType === 'project_created') {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2 text-[#a6e3a1]">
          <FolderOpen className="h-4 w-4" />
          <span className="text-sm">{message.content}</span>
        </div>
      </div>
    );
  }

  // ========== system 消息 ==========
  if (messageType === 'system') {
    // 检查是否应该隐藏
    if (metadata?.hidden_from_ui) {
      return null;
    }

    return (
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#f9e2af] animate-pulse" />
          <span className="text-[#f9e2af] text-sm">
            {message.content}
          </span>
        </div>
      </div>
    );
  }

  // ========== thinking 消息 - 可折叠 ==========
  if (messageType === 'thinking') {
    return (
      <div className="mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[#6c7086] hover:text-[#a6adc8] text-sm transition-colors"
        >
          <span className="text-[#6c7086]">●</span>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>Thinking</span>
        </button>
        {isExpanded && (
          <div className="mt-2 ml-5 p-3 bg-[#1e1e2e] border border-[#313244] rounded-lg text-sm text-[#a6adc8] max-h-[300px] overflow-y-auto">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </div>
        )}
      </div>
    );
  }

  // ========== tool_use 消息 - 工具执行指示器 ==========
  if (messageType === 'tool_use') {
    const toolName = metadata?.tool_name as string || 'Tool';
    const toolInput = metadata?.tool_input as Record<string, unknown> | undefined;

    // 获取工具图标和颜色
    const { icon: ToolIcon, color } = getToolIconAndColor(toolName);

    // 解析工具显示信息
    let displayText = toolName;
    let displayDetail = '';

    if (toolName === 'Write' && toolInput?.file_path) {
      const filePath = toolInput.file_path as string;
      const fileName = filePath.split('/').pop() || filePath;
      displayDetail = fileName;
    } else if (toolName === 'Read' && toolInput?.file_path) {
      const filePath = toolInput.file_path as string;
      const fileName = filePath.split('/').pop() || filePath;
      displayDetail = fileName;
    } else if (toolName === 'Bash' && toolInput?.command) {
      displayDetail = `\`${toolInput.command}\``;
    } else if (toolName === 'Edit' && toolInput?.file_path) {
      const filePath = toolInput.file_path as string;
      const fileName = filePath.split('/').pop() || filePath;
      displayDetail = fileName;
    } else if (toolName === 'WebSearch' && toolInput?.query) {
      displayDetail = `\`${toolInput.query}\``;
    } else if (toolName === 'Glob' && toolInput?.pattern) {
      displayDetail = `\`${toolInput.pattern}\``;
    } else if (toolName === 'Grep' && toolInput?.pattern) {
      displayDetail = `\`${toolInput.pattern}\``;
    }

    // 计算行数（如果有内容）
    const lineCount = toolInput?.content
      ? (toolInput.content as string).split('\n').length
      : null;

    return (
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className={color}>●</span>
          <div className="flex items-center gap-2 bg-[#313244] rounded-lg px-3 py-1.5">
            <ToolIcon className={`h-4 w-4 ${color}`} />
            <span className="text-[#cdd6f4] text-sm font-medium">{displayText}</span>
            {displayDetail && (
              <span className="text-[#89b4fa] text-sm font-mono truncate max-w-[200px]">
                {displayDetail}
              </span>
            )}
          </div>
        </div>
        {lineCount && (
          <div className="ml-5 mt-1 text-xs text-[#6c7086]">
            {lineCount} lines
          </div>
        )}
      </div>
    );
  }

  // ========== tool_result 消息 - 可折叠的工具结果 ==========
  if (messageType === 'tool_result') {
    const isError = metadata?.is_error === true;
    const status = metadata?.status as string || 'completed';

    return (
      <div className="mb-3 ml-5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-1 text-sm transition-colors",
            isError ? "text-[#f38ba8] hover:text-[#f38ba8]/80" : "text-[#6c7086] hover:text-[#a6adc8]"
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>{isError ? '执行失败' : status === 'success' ? '执行成功' : '结果'}</span>
        </button>
        {isExpanded && (
          <div className={cn(
            "mt-2 p-3 rounded-lg text-sm font-mono max-h-[300px] overflow-y-auto",
            isError
              ? "bg-[#f38ba8]/10 border border-[#f38ba8]/30 text-[#f38ba8]"
              : "bg-[#1e1e2e] border border-[#313244] text-[#a6adc8]"
          )}>
            <pre className="whitespace-pre-wrap break-words text-xs overflow-x-auto">
              {message.content}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ========== chat_complete 消息 - 会话完成 ==========
  if (messageType === 'chat_complete') {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2 text-[#a6e3a1] bg-[#a6e3a1]/10 rounded-lg px-3 py-2">
          <Check className="h-4 w-4" />
          <span className="text-sm">{message.content}</span>
        </div>
      </div>
    );
  }

  // ========== error 消息 ==========
  if (messageType === 'error') {
    return (
      <div className="mb-3">
        <div className="bg-[#f38ba8]/10 border border-[#f38ba8]/30 rounded-lg px-3 py-2 max-w-[85%]">
          <div className="text-[#f38ba8] text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // ========== chat 消息 ==========
  if (messageType === 'chat') {
    // 用户消息
    if (role === 'user') {
      return (
        <div className="flex justify-end mb-3">
          <div className="bg-[#f9a825] text-[#1e1e2e] rounded-lg px-3 py-2 max-w-[85%] text-sm">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          </div>
        </div>
      );
    }

    // Assistant 消息
    return (
      <div className="mb-3">
        <div className="bg-[#313244] border border-[#45475a] rounded-lg px-3 py-2 max-w-[90%]">
          <div className="text-[#cdd6f4] text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // ========== 兜底：未知消息类型 ==========
  return (
    <div className="mb-3">
      <div className="bg-[#313244] rounded-lg px-3 py-2 max-w-[85%] text-sm text-[#cdd6f4]">
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  );
}

// 根据工具名称获取图标和颜色
function getToolIconAndColor(toolName: string): { icon: typeof Terminal; color: string } {
  switch (toolName.toLowerCase()) {
    case 'write':
      return { icon: FileCode, color: 'text-[#89b4fa]' };
    case 'read':
      return { icon: Eye, color: 'text-[#94e2d5]' };
    case 'bash':
      return { icon: Terminal, color: 'text-[#fab387]' };
    case 'edit':
      return { icon: Pencil, color: 'text-[#cba6f7]' };
    case 'websearch':
      return { icon: Globe, color: 'text-[#89dceb]' };
    case 'webfetch':
      return { icon: Globe, color: 'text-[#89dceb]' };
    case 'glob':
      return { icon: Search, color: 'text-[#f9e2af]' };
    case 'grep':
      return { icon: Search, color: 'text-[#f9e2af]' };
    case 'todowrite':
      return { icon: FileText, color: 'text-[#a6e3a1]' };
    default:
      return { icon: Zap, color: 'text-[#89b4fa]' };
  }
}

// 流式消息加载动画
export function StreamingIndicator() {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#89b4fa] animate-pulse" />
        <span className="text-[#89b4fa] text-sm">
          <span className="animate-pulse">Calculating</span>
          <span className="inline-flex">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
          </span>
        </span>
      </div>
    </div>
  );
}
