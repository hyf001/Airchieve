import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FolderOpen,
  MessageSquare,
  BarChart3,
  Users,
  Settings,
  Home,
} from 'lucide-react';

const navigation = [
  { name: '首页', href: '/', icon: Home },
  { name: '项目管理', href: '/projects', icon: FolderOpen },
  { name: '对话', href: '/chat', icon: MessageSquare },
  { name: '评估中心', href: '/evaluation', icon: BarChart3 },
  { name: '用户管理', href: '/users', icon: Users },
  { name: '设置', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">AIrchieve</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
