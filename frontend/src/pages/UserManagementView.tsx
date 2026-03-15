import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Search, ChevronLeft as PrevIcon, ChevronRight as NextIcon, Shield, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  UserOut,
  UserListResponse,
  AdminUpdateUserRequest,
  adminListUsers,
  adminUpdateUser,
} from '../services/authService';
import { listStorybooks, StorybookListItem, StorybookStatus } from '../services/storybookService';
import StorybookPreview from '../components/StorybookPreview';
import LoadingSpinner from '../components/LoadingSpinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserManagementViewProps {
  onBack: () => void;
}

const MEMBERSHIP_LABELS: Record<string, string> = {
  free: '免费', lite: 'Lite', pro: 'Pro', max: 'Max',
};
const STATUS_LABELS: Record<string, string> = {
  active: '正常', banned: '已禁用', deleted: '已删除',
};

// ——— 编辑弹窗 ———

interface EditModalProps {
  user: UserOut;
  token: string;
  onClose: () => void;
  onSaved: (updated: UserOut) => void;
}

const EditModal: React.FC<EditModalProps> = ({ user, token, onClose, onSaved }) => {
  const [status, setStatus]   = useState(user.status);
  const [role, setRole]       = useState(user.role);
  const [pointsDelta, setPointsDelta]   = useState('');
  const [pointsDesc, setPointsDesc]     = useState('');
  const [freeCreation, setFreeCreation] = useState(String(user.free_creation_remaining));
  const [membershipLevel, setMembershipLevel] = useState(user.membership_level);
  const [expireAt, setExpireAt] = useState(
    user.membership_expire_at ? user.membership_expire_at.slice(0, 10) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const req: AdminUpdateUserRequest = {};
      if (status !== user.status)     req.status = status;
      if (role !== user.role)         req.role   = role;
      if (pointsDelta !== '' && pointsDelta !== '0') {
        const delta = parseInt(pointsDelta, 10);
        if (!isNaN(delta)) {
          req.points_delta = delta;
          req.points_description = pointsDesc || '管理员调整';
        }
      }
      const freeNum = parseInt(freeCreation, 10);
      if (!isNaN(freeNum) && freeNum !== user.free_creation_remaining)
        req.free_creation_remaining = freeNum;
      if (membershipLevel !== user.membership_level)
        req.membership_level = membershipLevel;
      if (membershipLevel !== 'free') {
        req.membership_expire_at = expireAt ? `${expireAt}T00:00:00` : null;
      } else {
        req.membership_expire_at = null;
      }

      const updated = await adminUpdateUser(token, user.id, req);
      onSaved(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white text-slate-900 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            编辑用户 <span className="text-indigo-600">#{user.id}</span> · {user.nickname}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="w-20 text-sm text-slate-500 shrink-0">账号状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">正常</SelectItem>
                <SelectItem value="banned">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label className="w-20 text-sm text-slate-500 shrink-0">用户角色</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Label className="w-20 text-sm text-slate-500 shrink-0">积分调整</Label>
            <Input
              type="number" value={pointsDelta}
              onChange={e => setPointsDelta(e.target.value)}
              placeholder={`当前 ${user.points_balance}，正数增加负数扣减`}
              className="flex-1"
            />
          </div>

          {pointsDelta && pointsDelta !== '0' && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm text-slate-500 shrink-0">调整备注</Label>
              <Input
                type="text" value={pointsDesc}
                onChange={e => setPointsDesc(e.target.value)}
                placeholder="备注（可选）" className="flex-1"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Label className="w-20 text-sm text-slate-500 shrink-0">免费次数</Label>
            <Input
              type="number" min={0} value={freeCreation}
              onChange={e => setFreeCreation(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <Label className="w-20 text-sm text-slate-500 shrink-0">VIP 等级</Label>
            <Select value={membershipLevel} onValueChange={(v) => setMembershipLevel(v as "free" | "lite" | "pro" | "max")}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">免费</SelectItem>
                <SelectItem value="lite">Lite</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="max">Max</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {membershipLevel !== 'free' && (
            <div className="flex items-center gap-3">
              <Label className="w-20 text-sm text-slate-500 shrink-0">到期日期</Label>
              <Input
                type="date" value={expireAt}
                onChange={e => setExpireAt(e.target.value)}
                className="flex-1"
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ——— 作品弹窗 ———

const WORK_STATUS_LABEL: Record<StorybookStatus, string> = {
  init: '初始化', creating: '生成中', updating: '更新中', finished: '已完成', error: '失败',
};

const statusToBadgeVariant: Record<StorybookStatus, 'muted' | 'info' | 'success' | 'destructive'> = {
  init: 'muted',
  creating: 'info',
  updating: 'info',
  finished: 'success',
  error: 'destructive',
};

const WORKS_PAGE_SIZE = 12;

interface WorksModalProps {
  user: UserOut;
  onClose: () => void;
}

const WorksModal: React.FC<WorksModalProps> = ({ user, onClose }) => {
  const [items, setItems]     = useState<StorybookListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset]   = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchWorks = useCallback(async (off: number, reset: boolean) => {
    setLoading(true);
    try {
      const data = await listStorybooks(
        { creator: String(user.id), limit: WORKS_PAGE_SIZE, offset: off },
      );
      if (reset) setItems(data);
      else setItems(prev => [...prev, ...data]);
      setHasMore(data.length === WORKS_PAGE_SIZE);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    setOffset(0);
    setItems([]);
    setHasMore(true);
    fetchWorks(0, true);
  }, [fetchWorks]);

  const handleLoadMore = () => {
    const next = offset + WORKS_PAGE_SIZE;
    setOffset(next);
    fetchWorks(next, false);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white text-slate-900 max-w-2xl max-h-[80vh] flex flex-col p-0">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 shrink-0">
          <BookOpen size={16} className="text-indigo-500" />
          <span className="font-semibold text-slate-800 text-sm">{user.nickname} 的作品</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 && !loading ? (
            <div className="py-16 text-center text-slate-400">
              <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无作品</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {items.map(item => (
                <div key={item.id}>
                  <StorybookPreview storybook={item} popupPosition="center" />
                  <div className="flex items-center justify-between mt-1.5 px-0.5">
                    <Badge variant={statusToBadgeVariant[item.status]} className="text-[10px]">
                      {WORK_STATUS_LABEL[item.status]}
                    </Badge>
                    <span className="text-[10px] text-slate-400">{item.created_at.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <LoadingSpinner size={20} color="text-indigo-400" className="py-6" />
          )}

          {!loading && hasMore && items.length > 0 && (
            <div className="text-center mt-4">
              <Button variant="outline" size="sm" onClick={handleLoadMore}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                加载更多
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ——— 主页面 ———

const UserManagementView: React.FC<UserManagementViewProps> = ({ onBack }) => {
  const { user: currentUser, token } = useAuth();

  const [users, setUsers]   = useState<UserOut[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading]   = useState(false);
  const [editingUser, setEditingUser]           = useState<UserOut | null>(null);
  const [viewingWorksUser, setViewingWorksUser] = useState<UserOut | null>(null);

  const PAGE_SIZE = 20;

  const fetchUsers = useCallback(async (p: number, q: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res: UserListResponse = await adminListUsers(token, p, PAGE_SIZE, q || undefined);
      setUsers(res.items);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(page, search); }, [fetchUsers, page, search]);

  const handleSearch = () => { setPage(1); setSearch(inputVal.trim()); };
  const handleSaved = (updated: UserOut) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setEditingUser(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">无权限访问</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-slate-500 hover:text-indigo-600 gap-1">
          <ChevronLeft size={18} /> 返回
        </Button>
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-indigo-500" />
          <span className="font-semibold text-slate-800">用户管理</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* 搜索栏 */}
        <div className="flex gap-2 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索昵称或用户 ID…"
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700">搜索</Button>
        </div>

        {/* 表格 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">昵称</th>
                  <th className="px-4 py-3 text-left font-medium">角色</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-right font-medium">积分</th>
                  <th className="px-4 py-3 text-right font-medium">免费次数</th>
                  <th className="px-4 py-3 text-left font-medium">VIP</th>
                  <th className="px-4 py-3 text-left font-medium">注册时间</th>
                  <th className="px-4 py-3 text-center font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">加载中…</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">暂无数据</td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono">{u.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{u.nickname}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'admin' ? 'destructive' : 'muted'}>
                        {u.role === 'admin' ? '管理员' : '用户'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.status === 'active' ? 'success' : 'warning'}>
                        {STATUS_LABELS[u.status] ?? u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{u.points_balance}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{u.free_creation_remaining}</td>
                    <td className="px-4 py-3">
                      {u.membership_level === 'free' ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        <Badge variant="default">{MEMBERSHIP_LABELS[u.membership_level]}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{u.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setViewingWorksUser(u)}
                          className="text-xs gap-1"
                        >
                          <BookOpen size={12} /> 作品
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setEditingUser(u)}
                          className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        >
                          编辑
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">共 {total} 条</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7">
                  <PrevIcon size={16} />
                </Button>
                <span className="text-xs text-slate-600">{page} / {totalPages}</span>
                <Button variant="ghost" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7">
                  <NextIcon size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingUser && token && (
        <EditModal user={editingUser} token={token} onClose={() => setEditingUser(null)} onSaved={handleSaved} />
      )}
      {viewingWorksUser && (
        <WorksModal user={viewingWorksUser} onClose={() => setViewingWorksUser(null)} />
      )}
    </div>
  );
};

export default UserManagementView;
