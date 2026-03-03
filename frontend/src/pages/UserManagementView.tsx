import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Search, ChevronLeft as PrevIcon, ChevronRight as NextIcon, X, Shield, BookOpen, Loader2 } from 'lucide-react';
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
      // 只有在等级不是 free 时才传 expire_at
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800">
            编辑用户 <span className="text-indigo-600">#{user.id}</span> · {user.nickname}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 状态 */}
          <div className="flex items-center gap-3">
            <label className="w-20 text-sm text-slate-500 shrink-0">账号状态</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="active">正常</option>
              <option value="banned">禁用</option>
            </select>
          </div>

          {/* 角色 */}
          <div className="flex items-center gap-3">
            <label className="w-20 text-sm text-slate-500 shrink-0">用户角色</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>

          {/* 积分调整 */}
          <div className="flex items-center gap-3">
            <label className="w-20 text-sm text-slate-500 shrink-0">积分调整</label>
            <input
              type="number"
              value={pointsDelta}
              onChange={e => setPointsDelta(e.target.value)}
              placeholder={`当前 ${user.points_balance}，正数增加负数扣减`}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {pointsDelta && pointsDelta !== '0' && (
            <div className="flex items-center gap-3">
              <label className="w-20 text-sm text-slate-500 shrink-0">调整备注</label>
              <input
                type="text"
                value={pointsDesc}
                onChange={e => setPointsDesc(e.target.value)}
                placeholder="备注（可选）"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* 免费次数 */}
          <div className="flex items-center gap-3">
            <label className="w-20 text-sm text-slate-500 shrink-0">免费次数</label>
            <input
              type="number"
              min={0}
              value={freeCreation}
              onChange={e => setFreeCreation(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* VIP 等级 */}
          <div className="flex items-center gap-3">
            <label className="w-20 text-sm text-slate-500 shrink-0">VIP 等级</label>
            <select
              value={membershipLevel}
              onChange={e => setMembershipLevel(e.target.value as "free" | "lite" | "pro" | "max")}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="free">免费</option>
              <option value="lite">Lite</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
          </div>

          {/* VIP 到期时间 */}
          {membershipLevel !== 'free' && (
            <div className="flex items-center gap-3">
              <label className="w-20 text-sm text-slate-500 shrink-0">到期日期</label>
              <input
                type="date"
                value={expireAt}
                onChange={e => setExpireAt(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ——— 作品弹窗 ———

const WORK_STATUS_LABEL: Record<StorybookStatus, string> = {
  init: '初始化', creating: '生成中', updating: '更新中', finished: '已完成', error: '失败',
};
const WORK_STATUS_COLOR: Record<StorybookStatus, string> = {
  init: 'bg-slate-100 text-slate-500',
  creating: 'bg-blue-100 text-blue-600',
  updating: 'bg-blue-100 text-blue-600',
  finished: 'bg-emerald-100 text-emerald-600',
  error: 'bg-red-100 text-red-500',
};
const WORKS_PAGE_SIZE = 12;

interface WorksModalProps {
  user: UserOut;
  onClose: () => void;
}

const WorksModal: React.FC<WorksModalProps> = ({ user, onClose }) => {
  const [items, setItems]   = useState<StorybookListItem[]>([]);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-indigo-500" />
            <span className="font-semibold text-slate-800 text-sm">
              {user.nickname} 的作品
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
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
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${WORK_STATUS_COLOR[item.status]}`}>
                      {WORK_STATUS_LABEL[item.status]}
                    </span>
                    <span className="text-[10px] text-slate-400">{item.created_at.slice(0, 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="text-indigo-400 animate-spin" />
            </div>
          )}

          {!loading && hasMore && items.length > 0 && (
            <div className="text-center mt-4">
              <button
                onClick={handleLoadMore}
                className="px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
              >
                加载更多
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [editingUser, setEditingUser]       = useState<UserOut | null>(null);
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

  const handleSearch = () => {
    setPage(1);
    setSearch(inputVal.trim());
  };

  const handleSaved = (updated: UserOut) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
    setEditingUser(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // 仅管理员可进入
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        无权限访问
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 text-sm"
        >
          <ChevronLeft size={18} /> 返回
        </button>
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
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="搜索昵称或用户 ID…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            搜索
          </button>
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
                      {u.role === 'admin' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-medium">管理员</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs">用户</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.status === 'active' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-medium">
                          {STATUS_LABELS[u.status]}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 text-xs font-medium">
                          {STATUS_LABELS[u.status] ?? u.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{u.points_balance}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{u.free_creation_remaining}</td>
                    <td className="px-4 py-3">
                      {u.membership_level === 'free' ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium">
                          {MEMBERSHIP_LABELS[u.membership_level]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {u.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setViewingWorksUser(u)}
                          className="px-3 py-1 rounded-lg border border-slate-200 text-slate-500 text-xs hover:bg-slate-50 transition-colors flex items-center gap-1"
                        >
                          <BookOpen size={12} /> 作品
                        </button>
                        <button
                          onClick={() => setEditingUser(u)}
                          className="px-3 py-1 rounded-lg border border-indigo-200 text-indigo-600 text-xs hover:bg-indigo-50 transition-colors"
                        >
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">共 {total} 条</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                >
                  <PrevIcon size={16} />
                </button>
                <span className="text-xs text-slate-600">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                >
                  <NextIcon size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editingUser && token && (
        <EditModal
          user={editingUser}
          token={token}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}

      {/* 作品弹窗 */}
      {viewingWorksUser && (
        <WorksModal
          user={viewingWorksUser}
          onClose={() => setViewingWorksUser(null)}
        />
      )}
    </div>
  );
};

export default UserManagementView;
