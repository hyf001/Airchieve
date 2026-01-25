import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi, projectsApi, createChatWebSocket, type Message } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Trash2, ArrowLeft, Bot, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ChatBubble, StreamingIndicator } from '@/components/chat/ChatBubble';

export function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [askBeforeEdits, setAskBeforeEdits] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: historyMessages } = useQuery({
    queryKey: ['messages', projectId],
    queryFn: () => chatApi.getMessages(projectId!),
    enabled: !!projectId,
  });

  const clearMutation = useMutation({
    mutationFn: () => chatApi.clearMessages(projectId!),
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
    }
  }, [historyMessages]);

  // WebSocket connection
  useEffect(() => {
    if (!projectId) return;

    const ws = createChatWebSocket(projectId);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message') {
          setMessages((prev) => [...prev, data.message]);
          setIsTyping(false);
        } else if (data.type === 'typing') {
          setIsTyping(true);
        } else if (data.type === 'error') {
          toast.error(data.message || '发生错误');
          setIsTyping(false);
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [projectId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      project_id: projectId!,
      role: 'user',
      message_type: 'chat',
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    wsRef.current.send(
      JSON.stringify({
        type: 'message',
        content: input,
      })
    );

    setInput('');
    setIsTyping(true);
  }, [input, projectId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1e1e2e]">
        <p className="text-[#6c7086]">请选择一个项目开始对话</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1e1e2e]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#313244] bg-[#181825] p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/projects')}
            className="text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-[#cdd6f4]">
              {project?.data?.name || '对话'}
            </h1>
            <div className="flex items-center gap-2">
              <Badge
                variant={isConnected ? 'default' : 'secondary'}
                className={isConnected ? 'bg-[#a6e3a1] text-[#1e1e2e]' : 'bg-[#45475a] text-[#6c7086]'}
              >
                {isConnected ? '已连接' : '未连接'}
              </Badge>
              {project?.data?.preferred_cli && (
                <Badge variant="outline" className="border-[#45475a] text-[#6c7086]">
                  {project.data.preferred_cli}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-[#45475a] text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#313244]"
          onClick={() => {
            if (confirm('确定要清除所有消息吗?')) {
              clearMutation.mutate();
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          清除消息
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-1">
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-[#6c7086] mt-20">
              <Bot className="h-16 w-16 mb-4" />
              <p className="text-lg text-[#cdd6f4]">AI 智能助手</p>
              <p className="text-sm">开始对话吧</p>
            </div>
          )}

          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {isTyping && <StreamingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-[#313244] bg-[#181825] p-4 space-y-3">
        {/* Input Box */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Queue another message..."
              disabled={!isConnected}
              className="pr-10 bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder:text-[#6c7086] focus-visible:ring-[#89b4fa]"
            />
          </div>
          <Button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="bg-[#89b4fa] hover:bg-[#74c7ec] text-[#1e1e2e]"
          >
            <Send className="h-4 w-4" />
          </Button>
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

// Chat list page for selecting a project
export function ChatListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { search }],
    queryFn: () => projectsApi.list({ search, page_size: 50 }),
  });

  const projects = data?.data?.items || [];

  return (
    <div className="space-y-6 bg-[#1e1e2e] min-h-full p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#cdd6f4]">对话</h1>
        <p className="text-[#6c7086]">选择一个项目开始 AI 对话</p>
      </div>

      <Card className="bg-[#181825] border-[#313244]">
        <CardHeader>
          <div className="relative">
            <Input
              placeholder="搜索项目..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#313244] border-[#45475a] text-[#cdd6f4] placeholder:text-[#6c7086]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[#6c7086]">加载中...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-[#6c7086]">暂无项目</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer transition-all bg-[#313244] border-[#45475a] hover:bg-[#45475a] hover:border-[#89b4fa]"
                  onClick={() => navigate(`/chat/${project.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-[#cdd6f4]">{project.name}</h3>
                        <p className="text-sm text-[#6c7086]">{project.preferred_cli}</p>
                      </div>
                      <Badge variant="outline" className="border-[#45475a] text-[#6c7086]">
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
