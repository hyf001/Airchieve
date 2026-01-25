import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { projectsApi, evalApi } from '@/lib/api';
import { FolderOpen, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';

export function HomePage() {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list({ page_size: 100 }),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['eval-dashboard'],
    queryFn: () => evalApi.getDashboard(),
  });

  const projectList = projects?.data?.items || [];
  const totalProjects = projectList.length;
  const likedProjects = projectList.filter((p) => p.user_rating === 'like').length;
  const dislikedProjects = projectList.filter((p) => p.user_rating === 'dislike').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">欢迎使用 AIrchieve</h1>
        <p className="text-slate-500">AI Agent 评估与管理平台</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总项目数</CardTitle>
            <FolderOpen className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">好评项目</CardTitle>
            <ThumbsUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{likedProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">差评项目</CardTitle>
            <ThumbsDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{dislikedProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待评估</CardTitle>
            <MessageSquare className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard?.data?.pending_evaluation || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近项目</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectList.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-slate-500">{project.preferred_cli}</p>
                  </div>
                  <div className="text-sm text-slate-400">
                    {new Date(project.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
              ))}
              {projectList.length === 0 && (
                <p className="text-center text-slate-500">暂无项目</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <a
                href="/projects"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50"
              >
                <FolderOpen className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">创建新项目</p>
                  <p className="text-sm text-slate-500">开始一个新的 AI Agent 项目</p>
                </div>
              </a>
              <a
                href="/evaluation"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50"
              >
                <MessageSquare className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">查看评估报告</p>
                  <p className="text-sm text-slate-500">分析 Agent 执行效果</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
