const API_BASE = '/api/v1/auth';
const USERS_BASE = '/api/v1/users';

// ============ Types ============

export interface UserOut {
  id: number;
  nickname: string;
  avatar_url: string | null;
  role: string;
  status: string;
  membership_level: 'free' | 'lite' | 'pro' | 'max';
  membership_expire_at: string | null;
  points_balance: number;
  free_creation_remaining: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserOut;
  is_new_user: boolean;
}

export interface PointsOverview {
  balance: number;
  free_creation_remaining: number;
}

export interface PointsLogItem {
  id: number;
  delta: number;
  type: string;
  description: string | null;
  balance_after: number;
  related_order_id: string | null;
  created_at: string;
}

// ============ Local Storage Keys ============

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getStoredUser  = (): UserOut | null => {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as UserOut) : null;
};
export const saveAuth = (token: string, user: UserOut): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
export const clearAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/** 构造带 Bearer Token 的请求头，用于需要认证的写接口 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
};

// ============ 401 全局处理 ============
// service 层检测到 401 时调用，由 AuthContext 注册具体行为（弹登录框）

let _onUnauthorized: (() => void) | null = null;
export const setOnUnauthorized = (fn: () => void): void => { _onUnauthorized = fn; };
export const triggerUnauthorized = (): void => { _onUnauthorized?.(); };

// ============ Internal helpers ============

/** 从 FastAPI 响应中提取可读错误信息
 *  - 正常业务错误：detail 是字符串
 *  - Pydantic 422 校验错误：detail 是对象数组，每项有 msg 字段
 */
const extractDetail = (data: { detail?: unknown }, fallback: string): string => {
  const d = data.detail;
  if (!d) return fallback;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    const msgs = d.map((e) => (typeof e === 'object' && e !== null && 'msg' in e ? String((e as { msg: unknown }).msg) : String(e)));
    return msgs.join('；');
  }
  return fallback;
};

const post = async <T>(url: string, body: unknown, token?: string): Promise<T> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractDetail(data, `请求失败 (${res.status})`));
  return data as T;
};

const get = async <T>(url: string, token: string): Promise<T> => {
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) throw new Error(extractDetail(data, `请求失败 (${res.status})`));
  return data as T;
};

// ============ Auth API ============

/** 账号密码注册 */
export const register = async (
  nickname: string,
  account: string,
  password: string,
): Promise<TokenResponse> =>
  post(`${API_BASE}/register`, { nickname, account, password });

/** 账号密码登录 */
export const loginByPassword = async (
  account: string,
  password: string,
): Promise<TokenResponse> =>
  post(`${API_BASE}/login/password`, { account, password });

/** 发送短信验证码 */
export const sendSmsCode = async (phone: string): Promise<{ message: string; debug_code?: string }> =>
  post(`${API_BASE}/sms/send`, { phone });

/** 手机验证码登录 */
export const loginBySms = async (
  phone: string,
  code: string,
): Promise<TokenResponse> =>
  post(`${API_BASE}/login/sms`, { phone, code });

/** 微信网页扫码登录（前端已获取 openid） */
export const loginByWechat = async (
  openid: string,
  nickname: string,
  avatar_url?: string,
  unionid?: string,
): Promise<TokenResponse> =>
  post(`${API_BASE}/login/wechat`, { openid, nickname, avatar_url, unionid });

// ============ User API ============

/** 验证 token 并获取当前用户信息 */
export const getMe = async (token: string): Promise<UserOut> =>
  get(`${USERS_BASE}/me`, token);

/** 获取积分概览 */
export const getPointsOverview = async (token: string): Promise<PointsOverview> =>
  get(`${USERS_BASE}/me/points`, token);
