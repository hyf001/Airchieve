import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type User, type CreateUserRequest, type UpdateUserRequest } from '@/lib/api';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Plus, Search, MoreHorizontal, Trash2, Edit, Shield, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<CreateUserRequest>({
    cert_fingerprint: '',
    email: '',
    name: '',
    is_admin: false,
    daily_limit: 100,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, page }],
    queryFn: () => authApi.getUsers({ search, page, page_size: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => authApi.addUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      setNewUser({
        cert_fingerprint: '',
        email: '',
        name: '',
        is_admin: false,
        daily_limit: 100,
      });
      toast.success('用户创建成功');
    },
    onError: () => {
      toast.error('创建用户失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ fingerprint, data }: { fingerprint: string; data: UpdateUserRequest }) =>
      authApi.updateUser(fingerprint, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditOpen(false);
      setSelectedUser(null);
      toast.success('用户更新成功');
    },
    onError: () => {
      toast.error('更新用户失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fingerprint: string) => authApi.deleteUser(fingerprint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('用户已删除');
    },
    onError: () => {
      toast.error('删除用户失败');
    },
  });

  const users = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const handleCreate = () => {
    if (!newUser.cert_fingerprint.trim() || !newUser.email.trim()) {
      toast.error('请填写必填字段');
      return;
    }
    createMutation.mutate(newUser);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;
    updateMutation.mutate({
      fingerprint: selectedUser.cert_fingerprint,
      data: {
        name: selectedUser.name,
        is_admin: selectedUser.is_admin,
        daily_limit: selectedUser.daily_limit,
      },
    });
  };

  const openEditDialog = (user: User) => {
    setSelectedUser({ ...user });
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-slate-500">管理系统授权用户和配额</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加用户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加新用户</DialogTitle>
              <DialogDescription>添加新的授权用户</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="fingerprint">证书指纹 *</Label>
                <Input
                  id="fingerprint"
                  value={newUser.cert_fingerprint}
                  onChange={(e) => setNewUser({ ...newUser, cert_fingerprint: e.target.value })}
                  placeholder="请输入证书指纹"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">邮箱 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="请输入邮箱"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daily_limit">每日限额</Label>
                <Input
                  id="daily_limit"
                  type="number"
                  value={newUser.daily_limit}
                  onChange={(e) => setNewUser({ ...newUser, daily_limit: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is_admin">管理员权限</Label>
                <Switch
                  id="is_admin"
                  checked={newUser.is_admin}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, is_admin: checked })}
                />
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="搜索用户..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-slate-500">加载中...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-slate-500">暂无用户</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>今日使用</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="w-[80px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.cert_fingerprint}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                            <UserIcon className="h-4 w-4 text-slate-600" />
                          </div>
                          <span className="font-medium">{user.name || '未设置'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.is_admin ? (
                          <Badge className="bg-purple-100 text-purple-700">
                            <Shield className="mr-1 h-3 w-3" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge variant="secondary">普通用户</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{user.used_today}</span>
                            <span className="text-slate-400">/ {user.daily_limit}</span>
                          </div>
                          <Progress
                            value={(user.used_today / user.daily_limit) * 100}
                            className="h-2"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm('确定要删除这个用户吗?')) {
                                  deleteMutation.mutate(user.cert_fingerprint);
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

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户信息</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>证书指纹</Label>
                <Input value={selectedUser.cert_fingerprint} disabled />
              </div>
              <div className="grid gap-2">
                <Label>邮箱</Label>
                <Input value={selectedUser.email} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name">姓名</Label>
                <Input
                  id="edit-name"
                  value={selectedUser.name || ''}
                  onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-limit">每日限额</Label>
                <Input
                  id="edit-limit"
                  type="number"
                  value={selectedUser.daily_limit}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser,
                      daily_limit: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-admin">管理员权限</Label>
                <Switch
                  id="edit-admin"
                  checked={selectedUser.is_admin}
                  onCheckedChange={(checked) =>
                    setSelectedUser({ ...selectedUser, is_admin: checked })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
