import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  FileImage,
  FilePlus,
  Upload,
  X,
  ArrowLeft,
  File,
  Loader2,
  Send,
  Bot,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  BarChart3,
  Image,
  FileSpreadsheet,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { chatApi, projectsApi, type Message } from '@/lib/api';
import type { ChatStreamMessage, ProjectFileInfo } from '@/lib/api';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ChatBubble, StreamingIndicator } from '@/components/chat/ChatBubble';

type SkillType = 'analysis' | 'image' | 'pdf' | 'excel' | 'word' | 'picturebook';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

const skills: { id: SkillType; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'analysis', label: '数据分析', icon: <BarChart3 className="w-4 h-4" />, desc: 'AI 智能分析数据，生成图表和报告' },
  { id: 'image', label: '图片生成', icon: <Image className="w-4 h-4" />, desc: 'AI 生成高质量图片和插图' },
  { id: 'pdf', label: 'PDF处理', icon: <FileText className="w-4 h-4" />, desc: 'PDF 文档的解析、编辑和转换' },
  { id: 'excel', label: 'Excel表格处理', icon: <FileSpreadsheet className="w-4 h-4" />, desc: 'Excel 表格数据处理和分析' },
  { id: 'word', label: 'Word处理', icon: <FilePlus className="w-4 h-4" />, desc: 'Word 文档的编辑和格式处理' },
  { id: 'picturebook', label: '绘本生成', icon: <BookOpen className="w-4 h-4" />, desc: 'AI 生成儿童绘本和故事插画' },
];

export function WorkspacePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileListRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { activeProjectId, setActiveProject } = useWorkspace();

  // 获取项目列表
  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectsApi.list({ page: 1, page_size: 50 }),
  });

  // 默认选择最近一个项目
  useEffect(() => {
    if (!activeProjectId && projectsData?.data?.items && projectsData.data.items.length > 0) {
      setActiveProject(projectsData.data.items[0].id);
    }
  }, [projectsData, activeProjectId, setActiveProject]);

  // 获取项目文件列表
  const { data: projectFilesData } = useQuery({
    queryKey: ['project-files', activeProjectId],
    queryFn: () => projectsApi.getFiles(activeProjectId!),
    enabled: !!activeProjectId,
  });

  const [selectedFile, setSelectedFile] = useState<ProjectFileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillType>('analysis');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(true); // HTML文件：true=预览效果，false=源代码

  // 判断是否为HTML文件
  const isHtmlFile = (mimeType: string, filename: string) => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return mimeType === 'text/html' || ext === '.html' || ext === '.htm';
  };

  // 判断是否为文本文件
  const isTextFile = (mimeType: string, filename: string) => {
    const textMimes = ['text/plain', 'text/markdown', 'text/csv', 'text/html', 'application/json'];
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return textMimes.some(m => mimeType.startsWith(m)) || textExtensions.includes(ext);
  };

  // 切换项目时清空选中的文件并刷新文件列表
  useEffect(() => {
    setSelectedFile(null);
    setFileContent(null);
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (activeProjectId) {
      queryClient.invalidateQueries({ queryKey: ['project-files', activeProjectId] });
    }
  }, [activeProjectId, queryClient]);

  // 选中文件时加载内容（文本文件或图片）
  useEffect(() => {
    // 清理之前的 blob URL
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }

    if (!selectedFile || !activeProjectId) {
      setFileContent(null);
      return;
    }

    const url = projectsApi.getFileContentUrl(activeProjectId, 'targets', selectedFile.name);
    const headers = {
      Authorization: `Bearer ${localStorage.getItem('airchieve_token')}`,
    };

    if (isTextFile(selectedFile.mime_type, selectedFile.name)) {
      setIsLoadingContent(true);
      fetch(url, { headers })
        .then(res => res.text())
        .then(text => {
          setFileContent(text);
          setIsLoadingContent(false);
        })
        .catch(() => {
          setFileContent(null);
          setIsLoadingContent(false);
        });
    } else if (selectedFile.mime_type.startsWith('image/')) {
      setIsLoadingContent(true);
      fetch(url, { headers })
        .then(res => res.blob())
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          setImageUrl(blobUrl);
          setIsLoadingContent(false);
        })
        .catch(() => {
          setImageUrl(null);
          setIsLoadingContent(false);
        });
    } else {
      setFileContent(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, activeProjectId]);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      project_id: '',
      role: 'assistant',
      message_type: 'chat',
      content: '你好！我是 Airchieve 智能助手。请上传文档并告诉我你想要如何处理它们，我会帮你完成。',
      created_at: new Date().toISOString(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    if (!activeProjectId) {
      toast.error('请先选择一个项目');
      return;
    }

    const fileArray = Array.from(selectedFiles);
    setIsUploading(true);

    try {
      // Upload files to server
      for (const file of fileArray) {
        await projectsApi.uploadFile(activeProjectId, file);
      }

      // Add uploaded files to local state
      const newFiles: UploadedFile[] = fileArray.map((file) => ({
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        type: file.type,
      }));

      setFiles((prev) => [...prev, ...newFiles].slice(0, 10));

      // Add assistant message about uploaded files
      const fileNames = fileArray.map((f) => f.name).join('、');
      const newMessage: Message = {
        id: Math.random().toString(36).substring(7),
        project_id: activeProjectId,
        role: 'assistant',
        message_type: 'chat',
        content: `已收到文件：${fileNames}。请告诉我你想要如何处理这些文档？`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMessage]);

      // Refresh project files
      queryClient.invalidateQueries({ queryKey: ['project-files', activeProjectId] });

      toast.success(`成功上传 ${fileArray.length} 个文件`);
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('文件上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, [activeProjectId, queryClient]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 刷新项目数据
  const refreshProject = useCallback(() => {
    if (activeProjectId) {
      queryClient.invalidateQueries({ queryKey: ['project-files', activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ['project', activeProjectId] });
      queryClient.invalidateQueries({ queryKey: ['projects-list'] });
    }
  }, [activeProjectId, queryClient]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isProcessing) return;

    // 收集上传的文件路径（assets 目录下的文件）
    const uploadedFilePaths = files.map((f) => {
      if (activeProjectId) {
        return projectsApi.getFileContentUrl(activeProjectId, 'assets', f.name);
      }
      return f.name;
    });

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      project_id: activeProjectId || '',
      role: 'user',
      message_type: 'chat',
      content: inputValue.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const question = inputValue.trim();
    setInputValue('');
    setIsProcessing(true);
    setStreamingContent('');
    // 清空上传文件列表
    setFiles([]);

    // 调用流式 API
    abortControllerRef.current = chatApi.streamChat(
      activeProjectId,
      question,
      // onMessage
      (message: ChatStreamMessage) => {
        // 处理项目创建消息
        if (message.message_type === 'project_created') {
          const metadata = message.metadata_json as {
            project_id: string;
            project_name: string;
          } | undefined;
          if (metadata?.project_id) {
            setActiveProject(metadata.project_id);
            queryClient.invalidateQueries({ queryKey: ['projects-list'] });
            toast.success(`已创建项目: ${metadata.project_name}`);
          }
          // 添加到消息列表
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            project_id: metadata?.project_id || activeProjectId || '',
            role: message.role as Message['role'],
            message_type: message.message_type as Message['message_type'],
            content: message.content,
            metadata_json: message.metadata_json,
            created_at: message.created_at,
          };
          setMessages((prev) => [...prev, newMessage]);
          return;
        }

        // 处理 chat_complete - 会话完成，刷新项目
        if (message.message_type === 'chat_complete') {
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            project_id: activeProjectId || '',
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

        // 处理 thinking, tool_use, tool_result, system, error - 添加到消息列表
        if (message.message_type === 'thinking' ||
            message.message_type === 'tool_use' ||
            message.message_type === 'tool_result' ||
            message.message_type === 'system' ||
            message.message_type === 'error') {
          const newMessage: Message = {
            id: `${Date.now()}-${Math.random()}`,
            project_id: activeProjectId || '',
            role: message.role as Message['role'],
            message_type: message.message_type as Message['message_type'],
            content: message.content,
            metadata_json: message.metadata_json,
            created_at: message.created_at,
          };
          setMessages((prev) => [...prev, newMessage]);
        }

        // 处理 chat 消息 - 流式内容
        if (message.message_type === 'chat') {
          setStreamingContent((prev) => prev + message.content);
        }

        // 滚动到底部（只滚动聊天容器，不滚动页面）
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 50);
      },
      // onError
      (error) => {
        console.error('Chat stream error:', error);
        const errorMessage: Message = {
          id: Math.random().toString(36).substring(7),
          project_id: activeProjectId || '',
          role: 'assistant',
          message_type: 'error',
          content: '抱歉，发生了错误，请稍后重试。',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsProcessing(false);
        setStreamingContent('');
      },
      // onComplete
      () => {
        // 将流式内容添加为完整的 assistant 消息
        setStreamingContent((prev) => {
          if (prev) {
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              project_id: activeProjectId || '',
              role: 'assistant',
              message_type: 'chat',
              content: prev,
              created_at: new Date().toISOString(),
            };
            setMessages((msgs) => [...msgs, assistantMessage]);
          }
          return '';
        });
        setIsProcessing(false);
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 100);
      },
      // model
      undefined,
      // files
      uploadedFilePaths.length > 0 ? uploadedFilePaths : undefined
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentSkill = skills.find((s) => s.id === selectedSkill);

  // 文件列表滚动
  const scrollFileList = (direction: 'left' | 'right') => {
    if (fileListRef.current) {
      const scrollAmount = 200;
      fileListRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] bg-[#141414]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-[#888] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">返回首页</span>
            </button>
            <div className="w-px h-6 bg-[#2a2a2a]" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-sm font-bold">
                A
              </div>
              <span className="font-semibold text-lg">Airchieve</span>
              <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">
                工作台
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* 项目选择下拉框 */}
            <Select
              value={activeProjectId || ''}
              onValueChange={(value) => setActiveProject(value || null)}
            >
              <SelectTrigger className="w-[180px] bg-[#1a1a1a] border-[#333] text-white">
                <FolderOpen className="h-4 w-4 mr-2 text-orange-400" />
                <SelectValue placeholder="选择项目" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a1a] border-[#333]">
                {projectsData?.data?.items?.map((project) => (
                  <SelectItem
                    key={project.id}
                    value={project.id}
                    className="text-white focus:bg-[#333] focus:text-white"
                  >
                    {project.name}
                  </SelectItem>
                ))}
                {(!projectsData?.data?.items || projectsData.data.items.length === 0) && (
                  <div className="px-2 py-1.5 text-sm text-[#666]">暂无项目</div>
                )}
              </SelectContent>
            </Select>

            <div className="w-px h-6 bg-[#2a2a2a]" />

            <span className="text-sm text-[#666]">
              积分余额: <span className="text-orange-400 font-medium">1000</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold mb-2">智能文档处理</h1>
              <p className="text-[#888]">上传文档，选择技能，与 AI 对话完成处理</p>
            </div>

            {/* Chat Dialog */}
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] flex flex-col h-[680px]">
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-[#2a2a2a] shrink-0">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-orange-400" />
                  <span className="text-sm font-medium">AI 助手</span>
                  {isProcessing && (
                    <span className="flex items-center gap-1 text-xs text-[#666]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      思考中...
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-1 chat-scrollbar"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#45475a transparent',
                }}
              >
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
                {/* 流式响应 */}
                {isProcessing && (
                  <>
                    {streamingContent ? (
                      <ChatBubble
                        message={{
                          id: 'streaming',
                          project_id: activeProjectId || '',
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
              </div>

              {/* Chat Input */}
              <div
                className="p-4 border-t border-[#2a2a2a] shrink-0 relative"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex gap-2">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入你的指令，按 Enter 发送..."
                    rows={1}
                    className="flex-1 bg-[#252525] border border-[#333] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-orange-500/50 placeholder:text-[#555]"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isProcessing}
                    className={cn(
                      'px-4 rounded-xl transition-all flex items-center justify-center',
                      inputValue.trim() && !isProcessing
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg hover:shadow-orange-500/25'
                        : 'bg-[#333] text-[#666] cursor-not-allowed'
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* 技能选择区域 */}
                <div className="mt-3 p-3 bg-[#252525] rounded-xl border border-[#333]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-[#888] shrink-0">技能:</span>
                    {skills.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSkill(s.id)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all',
                          selectedSkill === s.id
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                            : 'bg-[#1a1a1a] text-[#888] hover:bg-[#333] hover:text-white border border-[#333]'
                        )}
                      >
                        {s.icon}
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* 当前技能描述 */}
                  {currentSkill && (
                    <p className="mt-2 text-[10px] text-[#555]">{currentSkill.desc}</p>
                  )}
                </div>

                {/* 工具栏区域 */}
                <div className="mt-2 p-3 bg-[#252525] rounded-xl border border-[#333]">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 上传文档按钮 */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#333] rounded-lg text-xs text-[#888] hover:text-white transition-colors border border-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span>{isUploading ? '上传中...' : '上传文档'}</span>
                      {files.length > 0 && !isUploading && (
                        <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded text-[10px]">
                          {files.length}
                        </span>
                      )}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg"
                    />

                    {/* 清空上下文按钮 */}
                    <button
                      onClick={() => {
                        setMessages([{
                          id: '1',
                          project_id: '',
                          role: 'assistant',
                          message_type: 'chat',
                          content: '你好！我是 Airchieve 智能助手。请上传文档并告诉我你想要如何处理它们，我会帮你完成。',
                          created_at: new Date().toISOString(),
                        }]);
                        setFiles([]);
                        toast.success('已清空上下文');
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#333] rounded-lg text-xs text-[#888] hover:text-white transition-colors border border-[#333]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>清空上下文</span>
                    </button>

                    {/* 已上传文件列表 */}
                    {files.length > 0 && (
                      <>
                        <div className="w-px h-5 bg-[#333]" />
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-1 px-2 py-1 bg-[#1a1a1a] rounded-lg border border-[#333]"
                          >
                            <File className="w-3 h-3 text-orange-400" />
                            <span className="text-xs text-[#ccc] max-w-[80px] truncate">{file.name}</span>
                            <button
                              onClick={() => removeFile(file.id)}
                              className="p-0.5 hover:bg-[#333] rounded transition-colors"
                            >
                              <X className="w-3 h-3 text-[#666] hover:text-white" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* 拖拽上传区域 */}
                {isDragging && (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className="absolute inset-0 bg-orange-500/10 border-2 border-dashed border-orange-500 rounded-2xl flex items-center justify-center z-10"
                  >
                    <div className="text-center">
                      <Upload className="w-10 h-10 mx-auto mb-2 text-orange-400" />
                      <p className="text-sm text-orange-400">释放文件以上传</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-[#2a2a2a] shrink-0 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">处理结果</h2>
                <p className="text-xs text-[#666] mt-1">处理完成后结果将显示在这里</p>
              </div>
              {selectedFile && (
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-2 hover:bg-[#333] rounded-lg transition-colors text-[#888] hover:text-white"
                  title="全屏查看"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Document Preview Area */}
            <div className="p-4 border-b border-[#2a2a2a] overflow-hidden">
              <div className="h-[calc(100vh-380px)] bg-[#252525] rounded-xl border border-[#333] flex flex-col overflow-hidden">
                {selectedFile ? (
                  isLoadingContent ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                    </div>
                  ) : selectedFile.mime_type.startsWith('image/') && imageUrl ? (
                    <div className="flex-1 flex items-center justify-center p-4">
                      <img
                        src={imageUrl}
                        alt={selectedFile.name}
                        className="max-w-full max-h-full object-contain rounded-lg"
                      />
                    </div>
                  ) : fileContent !== null && isHtmlFile(selectedFile.mime_type, selectedFile.name) ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* 切换按钮 */}
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#333] shrink-0">
                        <button
                          onClick={() => setShowHtmlPreview(true)}
                          className={cn(
                            "px-3 py-1 text-xs rounded-md transition-colors",
                            showHtmlPreview
                              ? "bg-orange-500 text-white"
                              : "bg-[#333] text-[#888] hover:text-white"
                          )}
                        >
                          预览效果
                        </button>
                        <button
                          onClick={() => setShowHtmlPreview(false)}
                          className={cn(
                            "px-3 py-1 text-xs rounded-md transition-colors",
                            !showHtmlPreview
                              ? "bg-orange-500 text-white"
                              : "bg-[#333] text-[#888] hover:text-white"
                          )}
                        >
                          源代码
                        </button>
                      </div>
                      {/* 内容区域 */}
                      {showHtmlPreview ? (
                        <iframe
                          srcDoc={fileContent}
                          className="flex-1 w-full bg-white"
                          title={selectedFile.name}
                          sandbox="allow-scripts"
                        />
                      ) : (
                        <div
                          className="flex-1 overflow-auto"
                          style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: '#45475a transparent',
                          }}
                        >
                          <pre className="p-4 text-sm text-[#ccc] font-mono whitespace-pre-wrap break-words">
                            {fileContent}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : fileContent !== null ? (
                    <div
                      className="flex-1 overflow-auto"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#45475a transparent',
                      }}
                    >
                      <pre className="p-4 text-sm text-[#ccc] font-mono whitespace-pre-wrap break-words">
                        {fileContent}
                      </pre>
                    </div>
                  ) : selectedFile.mime_type === 'application/pdf' ? (
                    <iframe
                      src={projectsApi.getFileContentUrl(activeProjectId!, 'targets', selectedFile.name)}
                      className="w-full h-full min-h-[400px] rounded-lg"
                      title={selectedFile.name}
                    />
                  ) : selectedFile.thumbnail_url ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <img
                        src={selectedFile.thumbnail_url}
                        alt={selectedFile.name}
                        className="max-w-[200px] max-h-[200px] object-contain rounded-lg mb-3"
                      />
                      <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-[#666] mt-1">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <FileText className="w-16 h-16 text-orange-400 mb-3" />
                      <p className="text-sm text-white font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-[#666] mt-1">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-3">
                      <FileText className="w-8 h-8 text-[#444]" />
                    </div>
                    <p className="text-sm text-orange-400 mb-1">选择文件查看内容</p>
                    <p className="text-[#888] text-sm">点击下方文件卡片预览</p>
                  </div>
                )}
              </div>
            </div>

            {/* File Thumbnails from targets directory */}
            <div className="px-4 py-3 bg-[#151515] shrink-0">
              <h3 className="text-sm font-medium text-[#888] mb-2">文件列表</h3>

              {/* targets Directory File List */}
              {projectFilesData?.data?.items && projectFilesData.data.items.length > 0 ? (
                <div className="flex items-stretch gap-2">
                  {/* Left Arrow */}
                  <button
                    onClick={() => scrollFileList('left')}
                    className="flex-shrink-0 w-10 bg-[#252525] hover:bg-[#2a2a2a] rounded-lg flex items-center justify-center transition-colors border-2 border-transparent hover:border-[#333]"
                  >
                    <ChevronLeft className="w-5 h-5 text-[#888]" />
                  </button>

                  {/* File List Container */}
                  <div
                    ref={fileListRef}
                    className="flex gap-2 overflow-x-auto flex-1 scrollbar-hide"
                  >
                    {projectFilesData.data.items.map((file) => (
                      <div
                        key={file.name}
                        onClick={() => setSelectedFile(file)}
                        className={cn(
                          'rounded-lg p-2 cursor-pointer transition-all flex-shrink-0 w-24',
                          selectedFile?.name === file.name
                            ? 'bg-[#2a2a2a] border-2 border-orange-500'
                            : 'bg-[#252525] border-2 border-transparent hover:bg-[#2a2a2a]'
                        )}
                      >
                        <div className="aspect-square bg-[#1a1a1a] rounded flex items-center justify-center mb-1 overflow-hidden">
                          {file.thumbnail_url ? (
                            <img
                              src={file.thumbnail_url}
                              alt={file.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={cn(
                            'flex items-center justify-center',
                            file.thumbnail_url ? 'hidden' : ''
                          )}>
                            {file.mime_type.startsWith('image/') ? (
                              <FileImage className="w-6 h-6 text-orange-400" />
                            ) : (
                              <FileText className="w-6 h-6 text-[#666]" />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-white truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-[#666]">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Right Arrow */}
                  <button
                    onClick={() => scrollFileList('right')}
                    className="flex-shrink-0 w-10 bg-[#252525] hover:bg-[#2a2a2a] rounded-lg flex items-center justify-center transition-colors border-2 border-transparent hover:border-[#333]"
                  >
                    <ChevronRight className="w-5 h-5 text-[#888]" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 text-[#555] text-sm">
                  暂无文件
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section className="mt-16">
          <h2 className="text-xl font-bold mb-2 text-center">强大的文档处理能力</h2>
          <p className="text-[#888] text-center mb-8">AI 驱动，让文档处理变得简单高效</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '📄', title: '智能分析', desc: '深度理解文档内容，提取关键信息和摘要' },
              { icon: '🔄', title: '格式转换', desc: '支持 PDF、Word、Excel 等多种格式互转' },
              { icon: '📊', title: '数据提取', desc: '从表格和图表中提取结构化数据' },
              { icon: '🌍', title: '多语言翻译', desc: '保持原有格式的专业翻译服务' },
              { icon: '✨', title: '内容生成', desc: 'AI 辅助生成报告、摘要和文档' },
              { icon: '🔒', title: '安全可靠', desc: '文档加密处理，隐私安全有保障' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#333] transition-colors"
              >
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="font-medium mb-1">{item.title}</h3>
                <p className="text-sm text-[#666]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Fullscreen Modal */}
      {isFullscreen && selectedFile && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-orange-400" />
              <span className="text-white font-medium">{selectedFile.name}</span>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 hover:bg-[#333] rounded-lg transition-colors text-[#888] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 p-4 overflow-hidden">
            <div className="h-full bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden flex flex-col">
              {isHtmlFile(selectedFile.mime_type, selectedFile.name) && fileContent ? (
                <>
                  {/* 切换按钮 */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-[#333] shrink-0">
                    <button
                      onClick={() => setShowHtmlPreview(true)}
                      className={cn(
                        "px-3 py-1 text-xs rounded-md transition-colors",
                        showHtmlPreview
                          ? "bg-orange-500 text-white"
                          : "bg-[#333] text-[#888] hover:text-white"
                      )}
                    >
                      预览效果
                    </button>
                    <button
                      onClick={() => setShowHtmlPreview(false)}
                      className={cn(
                        "px-3 py-1 text-xs rounded-md transition-colors",
                        !showHtmlPreview
                          ? "bg-orange-500 text-white"
                          : "bg-[#333] text-[#888] hover:text-white"
                      )}
                    >
                      源代码
                    </button>
                  </div>
                  {/* 内容区域 */}
                  {showHtmlPreview ? (
                    <iframe
                      srcDoc={fileContent}
                      className="flex-1 w-full bg-white"
                      title={selectedFile.name}
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div
                      className="flex-1 overflow-auto"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#45475a transparent',
                      }}
                    >
                      <pre className="p-6 text-sm text-[#ccc] font-mono whitespace-pre-wrap break-words">
                        {fileContent}
                      </pre>
                    </div>
                  )}
                </>
              ) : selectedFile.mime_type.startsWith('image/') && imageUrl ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={imageUrl}
                    alt={selectedFile.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : fileContent !== null ? (
                <div
                  className="h-full overflow-auto"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#45475a transparent',
                  }}
                >
                  <pre className="p-6 text-sm text-[#ccc] font-mono whitespace-pre-wrap break-words">
                    {fileContent}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-[#666]">
          &copy; 2024 Airchieve. AI 驱动的智能文档处理平台
        </div>
      </footer>
    </div>
  );
}
