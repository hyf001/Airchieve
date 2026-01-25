import { Bell, Search, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorkspace } from '@/context/WorkspaceContext';
import { projectsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function Header() {
  const { activeProjectId, setActiveProject } = useWorkspace();

  // 获取项目列表
  const { data: projectsData } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => projectsApi.list({ page: 1, page_size: 50 }),
  });

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索项目..."
            className="w-80 pl-10"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* 项目选择下拉框 */}
        <Select
          value={activeProjectId || ''}
          onValueChange={(value) => setActiveProject(value || null)}
        >
          <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
            <FolderOpen className="h-4 w-4 mr-2 text-slate-500" />
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projectsData?.data?.items?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
            {(!projectsData?.data?.items || projectsData.data.items.length === 0) && (
              <div className="px-2 py-1.5 text-sm text-slate-500">暂无项目</div>
            )}
          </SelectContent>
        </Select>

        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>我的账户</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>个人设置</DropdownMenuItem>
            <DropdownMenuItem>配额信息</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>退出登录</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
