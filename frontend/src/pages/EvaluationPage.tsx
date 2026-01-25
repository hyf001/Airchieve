import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { evalApi, type EvalProject } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  FileText,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

export function EvaluationPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    user_rating: '',
    has_evaluation: '',
    annotation_status: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['eval-projects', { search, page, ...filters }],
    queryFn: () =>
      evalApi.getProjects({
        search,
        page,
        page_size: 20,
        user_rating: filters.user_rating || undefined,
        has_evaluation: filters.has_evaluation ? filters.has_evaluation === 'true' : undefined,
        annotation_status: filters.annotation_status || undefined,
      }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['eval-dashboard'],
    queryFn: () => evalApi.getDashboard(),
  });

  // filterOptions available for future use
  useQuery({
    queryKey: ['eval-filter-options'],
    queryFn: () => evalApi.getFilterOptions(),
  });

  const projects = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const getRatingBadge = (rating: EvalProject['user_rating']) => {
    if (rating === 'like') {
      return (
        <Badge className="bg-green-100 text-green-700">
          <ThumbsUp className="mr-1 h-3 w-3" />
          好评
        </Badge>
      );
    }
    if (rating === 'dislike') {
      return (
        <Badge className="bg-red-100 text-red-700">
          <ThumbsDown className="mr-1 h-3 w-3" />
          差评
        </Badge>
      );
    }
    return <Badge variant="secondary">未评分</Badge>;
  };

  const getAnnotationBadge = (status: EvalProject['latest_annotation_status']) => {
    if (status === 'open') {
      return (
        <Badge className="bg-yellow-100 text-yellow-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          待处理
        </Badge>
      );
    }
    if (status === 'close') {
      return (
        <Badge className="bg-green-100 text-green-700">
          <CheckCircle className="mr-1 h-3 w-3" />
          已解决
        </Badge>
      );
    }
    return <Badge variant="outline">无标注</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">评估中心</h1>
        <p className="text-slate-500">查看和管理 AI Agent 执行评估</p>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总项目数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.data?.total_projects || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">已评估</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {dashboard?.data?.evaluated || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">待评估</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {dashboard?.data?.pending_evaluation || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">待处理标注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {dashboard?.data?.open_annotations || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="搜索项目..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.user_rating}
              onValueChange={(v) => setFilters({ ...filters, user_rating: v })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="评分筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="like">好评</SelectItem>
                <SelectItem value="dislike">差评</SelectItem>
                <SelectItem value="null">未评分</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.has_evaluation}
              onValueChange={(v) => setFilters({ ...filters, has_evaluation: v })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="评估状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="true">已评估</SelectItem>
                <SelectItem value="false">未评估</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.annotation_status}
              onValueChange={(v) => setFilters({ ...filters, annotation_status: v })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="标注状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                <SelectItem value="open">待处理</SelectItem>
                <SelectItem value="close">已解决</SelectItem>
                <SelectItem value="none">无标注</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead>智能体</TableHead>
                    <TableHead>消息数</TableHead>
                    <TableHead>评分</TableHead>
                    <TableHead>评估</TableHead>
                    <TableHead>标注</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{project.preferred_cli}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-4 w-4 text-slate-400" />
                          {project.message_count}
                        </div>
                      </TableCell>
                      <TableCell>{getRatingBadge(project.user_rating)}</TableCell>
                      <TableCell>
                        {project.has_evaluation_file ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            已评估
                          </Badge>
                        ) : (
                          <Badge variant="secondary">未评估</Badge>
                        )}
                      </TableCell>
                      <TableCell>{getAnnotationBadge(project.latest_annotation_status)}</TableCell>
                      <TableCell>
                        {new Date(project.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/evaluation/${project.id}`)}
                        >
                          <FileText className="mr-1 h-4 w-4" />
                          详情
                        </Button>
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

// Evaluation Detail Page
export function EvaluationDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [annotationContent, setAnnotationContent] = useState('');

  const { data: trace, isLoading: traceLoading } = useQuery({
    queryKey: ['eval-trace', projectId],
    queryFn: () => evalApi.getTrace(projectId!),
    enabled: !!projectId,
  });

  const { data: report } = useQuery({
    queryKey: ['eval-report', projectId],
    queryFn: () => evalApi.getEvaluationReport(projectId!),
    enabled: !!projectId,
  });

  const { data: annotations, refetch: refetchAnnotations } = useQuery({
    queryKey: ['eval-annotations', projectId],
    queryFn: () => evalApi.getAnnotations(projectId!),
    enabled: !!projectId,
  });

  const evaluateMutation = useMutation({
    mutationFn: () => evalApi.startEvaluation(projectId!),
    onSuccess: () => {
      toast.success('评估任务已启动');
      queryClient.invalidateQueries({ queryKey: ['eval-report', projectId] });
    },
    onError: () => {
      toast.error('启动评估失败');
    },
  });

  const createAnnotationMutation = useMutation({
    mutationFn: (content: string) => evalApi.createAnnotation(projectId!, { content }),
    onSuccess: () => {
      toast.success('标注已创建');
      setIsAnnotationOpen(false);
      setAnnotationContent('');
      refetchAnnotations();
    },
    onError: () => {
      toast.error('创建标注失败');
    },
  });

  const updateAnnotationStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'open' | 'close' }) =>
      evalApi.updateAnnotationStatus(id, status),
    onSuccess: () => {
      toast.success('标注状态已更新');
      refetchAnnotations();
    },
  });

  const annotationList = annotations?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/evaluation')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">评估详情</h1>
            <p className="text-slate-500">项目 ID: {projectId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAnnotationOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            添加标注
          </Button>
          <Button onClick={() => evaluateMutation.mutate()} disabled={evaluateMutation.isPending}>
            <Play className="mr-2 h-4 w-4" />
            {evaluateMutation.isPending ? '评估中...' : '启动评估'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="trace">
        <TabsList>
          <TabsTrigger value="trace">执行追踪</TabsTrigger>
          <TabsTrigger value="report">评估报告</TabsTrigger>
          <TabsTrigger value="annotations">
            标注 ({annotationList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trace" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {traceLoading ? (
                <div className="flex h-60 items-center justify-center">
                  <p className="text-slate-500">加载中...</p>
                </div>
              ) : trace?.data ? (
                <ScrollArea className="h-[600px]">
                  <pre className="whitespace-pre-wrap text-sm">{trace.data.content}</pre>
                </ScrollArea>
              ) : (
                <div className="flex h-60 items-center justify-center">
                  <p className="text-slate-500">暂无追踪数据</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {report?.data ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {report.data.scores && (
                      <div>
                        <h3 className="font-semibold mb-2">评分</h3>
                        <div className="grid gap-2 md:grid-cols-3">
                          {Object.entries(report.data.scores).map(([key, value]) => (
                            <div key={key} className="rounded-lg border p-3">
                              <p className="text-sm text-slate-500">{key}</p>
                              <p className="text-xl font-bold">{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.data.summary && (
                      <div>
                        <h3 className="font-semibold mb-2">总结</h3>
                        <p className="text-slate-600">{report.data.summary}</p>
                      </div>
                    )}
                    {report.data.issues && report.data.issues.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">问题</h3>
                        <ul className="list-disc list-inside space-y-1">
                          {report.data.issues.map((issue: string, i: number) => (
                            <li key={i} className="text-slate-600">
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex h-60 items-center justify-center">
                  <p className="text-slate-500">暂无评估报告，请先启动评估</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annotations" className="mt-4">
          <Card>
            <CardContent className="p-4">
              {annotationList.length === 0 ? (
                <div className="flex h-60 items-center justify-center">
                  <p className="text-slate-500">暂无标注</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {annotationList.map((annotation: any) => (
                    <div key={annotation.id} className="rounded-lg border p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm text-slate-500 mb-2">
                            {annotation.created_by} ·{' '}
                            {new Date(annotation.created_at).toLocaleString('zh-CN')}
                          </p>
                          <p>{annotation.content}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              annotation.status === 'open'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }
                          >
                            {annotation.status === 'open' ? '待处理' : '已解决'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateAnnotationStatusMutation.mutate({
                                id: annotation.id,
                                status: annotation.status === 'open' ? 'close' : 'open',
                              })
                            }
                          >
                            {annotation.status === 'open' ? (
                              <>
                                <CheckCircle className="mr-1 h-4 w-4" />
                                解决
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-1 h-4 w-4" />
                                重开
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Annotation Dialog */}
      <Dialog open={isAnnotationOpen} onOpenChange={setIsAnnotationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加标注</DialogTitle>
            <DialogDescription>为此项目添加问题标注或评论</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={annotationContent}
              onChange={(e) => setAnnotationContent(e.target.value)}
              placeholder="请输入标注内容..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAnnotationOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => createAnnotationMutation.mutate(annotationContent)}
              disabled={!annotationContent.trim() || createAnnotationMutation.isPending}
            >
              {createAnnotationMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
