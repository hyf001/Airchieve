import { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { chatApi, type Message, type ChatStreamMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send,
  Trash2,
  Bot,
  X,
  MessageSquare,
  Pencil,
  Square
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { ChatBubble, StreamingIndicator } from '@/components/chat/ChatBubble';

export function ChatPanel() {
  const { isChatOpen, toggleChat, activeProjectId, setActiveProject } = useWorkspace();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [askBeforeEdits, setAskBeforeEdits] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectId = activeProjectId;

  const { data: historyMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', projectId],
    queryFn: async () => {
      if (!projectId) {
        return {
          data: [],
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        } as AxiosResponse<Message[]>;
      }
      return chatApi.getMessages(projectId);
    },
    enabled: !!projectId,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) return;
      return chatApi.clearMessages(projectId);
    },
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['messages', projectId] });
      toast.success('消息已清除');
    },
  });

  // Initialize messages from history
  useEffect(() => {
    if (historyMessages?.data) {
      setMessages(historyMessages.data);
    } else {
      setMessages([]);
    }
  }, [historyMessages, projectId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, streamingContent]);

  // 刷新项目数据（类似切换项目）
  const refreshProject = useCallback(() => {
    if (projectId) {
      // 刷新项目文件列表
      queryClient.invalidateQueries({ queryKey: ['project-files', projectId] });
      // 刷新项目详情
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      // 刷新项目列表
      queryClient.invalidateQueries({ queryKey: ['projects-list'] });
      // 刷新消息历史
      refetchMessages();
    }
  }, [projectId, queryClient, refetchMessages]);

  const sendMessage = useCallback(() => {
    if (!input.trim()) {
      return;
    }

    const question = input;
    setInput('');

    // Optimistic update - add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      project_id: projectId || 'pending',
      role: 'user',
      message_type: 'chat',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingContent('');

    // Use streamChat API
    const controller = chatApi.streamChat(
      projectId,
      question,
      (message: ChatStreamMessage) => {
        // Handle project_created message
        if (message.message_type === 'project_created') {
          const metadata = message.metadata_json as {
            project_id: string;
            project_name: string;
            project_description: string;
          } | undefined;

          if (metadata?.project_id) {
            // Update active project
            setActiveProject(metadata.project_id);
            // Refresh projects list
            queryClient.invalidateQueries({ queryKey: ['projects-list'] });
            toast.success(`已创建项目: ${metadata.project_name}`);
          }
          // 也添加到消息列表
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            project_id: metadata?.project_id || projectId || '',
            role: message.role as Message['role'],
            message_type: message.message_type as Message['message_type'],
            content: message.content,
            metadata_json: message.metadata_json,
            created_at: message.created_at,
          };
          setMessages((prev) => [...prev, newMessage]);
          return;
        }

        // Handle chat_complete - 会话完成，刷新项目
        if (message.message_type === 'chat_complete') {
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            project_id: projectId || '',
            role: message.role as Message['role'],
            message_type: message.message_type as Message['message_type'],
            content: message.content,
            metadata_json: message.metadata_json,
            created_at: message.created_at,
          };
          setMessages((prev) => [...prev, newMessage]);
          // 刷新项目数据
          refreshProject();
          return;
        }

        // Handle streaming messages - add all types to messages list
        if (message.message_type === 'thinking' ||
            message.message_type === 'tool_use' ||
            message.message_type === 'tool_result' ||
            message.message_type === 'system' ||
            message.message_type === 'error') {
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            project_id: projectId || '',
            role: message.role as Message['role'],
            message_type: message.message_type as Message['message_type'],
            content: message.content,
            metadata_json: message.metadata_json,
            created_at: message.created_at,
          };
          setMessages((prev) => [...prev, newMessage]);
        }

        // Handle chat messages - stream content
        if (message.message_type === 'chat') {
          setStreamingContent((prev) => prev + message.content);
        }
      },
      (error) => {
        toast.error(error.message || '发送消息失败');
        setIsStreaming(false);
        setStreamingContent('');
      },
      () => {
        // On complete - add the full assistant message
        setStreamingContent((prev) => {
          if (prev) {
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              project_id: projectId || '',
              role: 'assistant',
              message_type: 'chat',
              content: prev,
              created_at: new Date().toISOString(),
            };
            setMessages((msgs) => [...msgs, assistantMessage]);
          }
          return '';
        });
        setIsStreaming(false);
      }
    );

    abortControllerRef.current = controller;
  }, [input, projectId, setActiveProject, queryClient, refreshProject]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 停止当前流式响应
  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      // 保存当前已流式的内容
      if (streamingContent) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          project_id: projectId || '',
          role: 'assistant',
          message_type: 'chat',
          content: streamingContent + '\n\n[已中断]',
          created_at: new Date().toISOString(),
        };
        setMessages((msgs) => [...msgs, assistantMessage]);
        setStreamingContent('');
      }
    }
  }, [streamingContent, projectId]);

  if (!isChatOpen) {
    return (
      <div className="h-full w-full bg-[#1e1e2e] flex flex-col items-center py-2 gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]"
          onClick={toggleChat}
          title="打开对话"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e2e] overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-[#313244] flex items-center justify-between px-3 bg-[#181825] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[#cdd6f4] truncate">AI 助手</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]"
            onClick={() => {
              if (projectId && confirm('确定要清除所有消息吗?')) {
                clearMutation.mutate();
              }
            }}
            title="清除消息"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]"
            onClick={toggleChat}
            title="关闭面板"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages - 自定义滚动条样式 */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 chat-scrollbar"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#45475a transparent',
        }}
      >
        <div className="space-y-1">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-[#6c7086] mt-10">
              <Bot className="h-12 w-12 mb-2" />
              <p className="text-sm text-[#cdd6f4]">AI 智能助手</p>
              <p className="text-xs">输入问题开始对话，将自动创建项目</p>
            </div>
          )}

          {/* 渲染消息列表 */}
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {/* 流式响应 */}
          {isStreaming && (
            <>
              {streamingContent ? (
                <ChatBubble
                  message={{
                    id: 'streaming',
                    project_id: projectId || '',
                    role: 'assistant',
                    message_type: 'chat',
                    content: streamingContent,
                    created_at: new Date().toISOString(),
                  }}
                />
              ) : (
                <StreamingIndicator />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#313244] bg-[#181825] shrink-0 space-y-2">
        {/* Input Box */}
        <div className="relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入你的指令，按 Enter 发送..."
            disabled={isStreaming}
            className="pr-10 bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder:text-[#6c7086] focus-visible:ring-[#89b4fa]"
          />
          {isStreaming ? (
            <Button
              size="icon"
              className="absolute right-1 top-1 h-7 w-7 bg-[#f38ba8] hover:bg-[#f38ba8]/80 text-[#1e1e2e]"
              onClick={stopStreaming}
              title="停止"
            >
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="absolute right-1 top-1 h-7 w-7 bg-[#89b4fa] hover:bg-[#74c7ec] text-[#1e1e2e]"
              onClick={sendMessage}
              disabled={!input.trim()}
            >
              <Send className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Ask before edits toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setAskBeforeEdits(!askBeforeEdits)}
            className="flex items-center gap-2 text-xs text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
          >
            <Pencil className="h-3 w-3" />
            <span>Ask before edits</span>
            <div
              className={`w-8 h-4 rounded-full transition-colors relative ${
                askBeforeEdits ? 'bg-[#89b4fa]' : 'bg-[#45475a]'
              }`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  askBeforeEdits ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
