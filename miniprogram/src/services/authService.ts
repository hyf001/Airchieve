import { get, post, patch } from '../utils/request'
import { storage } from '../utils/storage'

const AUTH  = '/api/v1/auth'
const USERS = '/api/v1/users'

// ============ Types ============

export type MembershipLevel = 'free' | 'lite' | 'pro' | 'max'

export interface UserOut {
  id: number
  nickname: string
  avatar_url: string | null
  role: string
  status: string
  membership_level: MembershipLevel
  membership_expire_at: string | null
  points_balance: number
  free_creation_remaining: number
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: UserOut
  is_new_user: boolean
}

export interface PointsOverview {
  balance: number
  free_creation_remaining: number
}

export interface PointsLogItem {
  id: number
  delta: number
  type: string
  description: string | null
  balance_after: number
  related_order_id: string | null
  created_at: string
}

// ============ Storage ============

export const getStoredToken = (): string | null => storage.get('auth_token')

export const getStoredUser = (): UserOut | null => {
  const raw = storage.get('auth_user')
  return raw ? (JSON.parse(raw) as UserOut) : null
}

export const saveAuth = (token: string, user: UserOut): void => {
  storage.set('auth_token', token)
  storage.set('auth_user', JSON.stringify(user))
}

export const clearAuth = (): void => {
  storage.remove('auth_token')
  storage.remove('auth_user')
}

// ============ Auth API ============

/** 微信小程序登录：前端用 wx.login() 拿到 code，连同昵称头像一起发给后端 */
export const loginByWechatMini = (
  code: string,
  nickname: string,
  avatar_url?: string,
): Promise<TokenResponse> =>
  post<TokenResponse>(`${AUTH}/login/wechat-mini`, { code, nickname, avatar_url }, false)

// ============ User API ============

export const getMe = (): Promise<UserOut> =>
  get<UserOut>(`${USERS}/me`)

export const getPointsOverview = (): Promise<PointsOverview> =>
  get<PointsOverview>(`${USERS}/me/points`)

export const getPointsLog = (page = 1, size = 20): Promise<PointsLogItem[]> =>
  get<PointsLogItem[]>(`${USERS}/me/points/log?page=${page}&size=${size}`)

// ============ Admin API ============

export interface UserListResponse {
  total: number
  items: UserOut[]
}

export interface AdminUpdateUserRequest {
  status?: string
  role?: string
  points_delta?: number
  points_description?: string
  free_creation_remaining?: number
  membership_level?: string
  membership_expire_at?: string | null
}

export const adminListUsers = (
  page = 1, size = 20, search?: string,
): Promise<UserListResponse> => {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (search) params.set('search', search)
  return get<UserListResponse>(`${USERS}/?${params}`)
}

export const adminUpdateUser = (
  userId: number,
  data: AdminUpdateUserRequest,
): Promise<UserOut> =>
  patch<UserOut>(`${USERS}/${userId}`, data)
