import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type Project, type CreateProjectRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  MoreHorizontal,
  MessageSquare,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const AGENT_TYPES = [
  { value: 'analysis', label: '数据分析' },
  { value: 'analysis-team', label: '分析团队' },
  { value: 'tracking-design', label: '埋点设计' },
  { value: 'fin-analysis', label: '金融分析' },
  { value: 'datawarehouse-quality', label: '数据质量' },
  { value: 'cost-govern', label: '成本治理' },
];

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectRequest>({
    name: '',
    preferred_cli: 'analysis',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { search, page }],
    queryFn: () => projectsApi.list({ search, page, page_size: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProjectRequest) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsCreateOpen(false);
      setNewProject({ name: '', preferred_cli: 'analysis' });
      toast.success('项目创建成功');
    },
    onError: () => {
      toast.error('创建项目失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => projectsApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('项目已删除');
    },
    onError: () => {
      toast.error('删除项目失败');
    },
  });

  const rateMutation = useMutation({
    mutationFn: ({ projectId, rating }: { projectId: string; rating: 'like' | 'dislike' }) =>
      projectsApi.rate(projectId, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('评分成功');
    },
  });

  const projects = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const handleCreate = () => {
    if (!newProject.name.trim()) {
      toast.error('请输入项目名称');
      return;
    }
    createMutation.mutate(newProject);
  };

  const getRatingBadge = (rating: Project['user_rating']) => {
    if (rating === 'like') {
      return (
        <Badge variant="outline" className="border-green-500 text-green-600">
          <ThumbsUp className="mr-1 h-3 w-3" />
          好评
        </Badge>
      );
    }
    if (rating === 'dislike') {
      return (
        <Badge variant="outline" className="border-red-500 text-red-600">
          <ThumbsDown className="mr-1 h-3 w-3" />
          差评
        </Badge>
      );
    }
    return <Badge variant="secondary">未评分</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理</h1>
          <p className="text-slate-500">管理和查看所有 AI Agent 项目</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              创建项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建新项目</DialogTitle>
              <DialogDescription>填写项目信息以创建新的 AI Agent 项目</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">项目名称</Label>
                <Input
                  id="name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="请输入项目名称"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agent">智能体类型</Label>
                <Select
                  value={newProject.preferred_cli}
                  onValueChange={(value) => setNewProject({ ...newProject, preferred_cli: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择智能体类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? '创建中...' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="搜索项目..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-slate-500">加载中...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-slate-500">暂无项目</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>项目名称</TableHead>
                    <TableHead>智能体类型</TableHead>
                    <TableHead>创建者</TableHead>
                    <TableHead>评分</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{project.preferred_cli}</Badge>
                      </TableCell>
                      <TableCell>{project.created_by || '-'}</TableCell>
                      <TableCell>{getRatingBadge(project.user_rating)}</TableCell>
                      <TableCell>
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/chat/${project.id}`)}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              进入对话
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/evaluation/${project.id}`)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              查看评估
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                rateMutation.mutate({ projectId: project.id, rating: 'like' })
                              }
                            >
                              <ThumbsUp className="mr-2 h-4 w-4" />
                              点赞
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                rateMutation.mutate({ projectId: project.id, rating: 'dislike' })
                              }
                            >
                              <ThumbsDown className="mr-2 h-4 w-4" />
                              点踩
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('确定要删除这个项目吗?')) {
                                  deleteMutation.mutate(project.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
