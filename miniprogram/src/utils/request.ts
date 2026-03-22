import Taro from '@tarojs/taro'
import { API_BASE_URL } from './config'
import { storage } from './storage'

// 全局 401 回调，由 AuthContext 注册
let _onUnauthorized: (() => void) | null = null
export const setOnUnauthorized = (fn: () => void): void => { _onUnauthorized = fn }
export const triggerUnauthorized = (): void => { _onUnauthorized?.() }

export const getAuthHeader = (): Record<string, string> => {
  const token = storage.get('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  auth?: boolean  // 是否携带 token，默认 true
}

// 统一提取 FastAPI 错误信息（兼容 string detail 和 Pydantic 数组 detail）
const extractDetail = (data: { detail?: unknown }, fallback: string): string => {
  const d = data.detail
  if (!d) return fallback
  if (typeof d === 'string') return d
  if (Array.isArray(d)) {
    return d.map((e: unknown) =>
      typeof e === 'object' && e !== null && 'msg' in e ? String((e as { msg: unknown }).msg) : String(e)
    ).join('；')
  }
  return fallback
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, auth = true } = options
  const url = `${API_BASE_URL}${path}`
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(auth ? getAuthHeader() : {}),
  }

  return new Promise((resolve, reject) => {
    Taro.request({
      url,
      method,
      data: data ? JSON.stringify(data) : undefined,
      header,
      success(res) {
        if (res.statusCode === 401) {
          triggerUnauthorized()
          reject(new Error('请先登录'))
          return
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T)
          return
        }
        const body = res.data as { detail?: unknown }
        const msg = extractDetail(body, `请求失败 (${res.statusCode})`)
        // 积分不足
        if (res.statusCode === 402 && (body as { detail?: { code?: string } }).detail && (body as { detail: { code?: string } }).detail.code === 'INSUFFICIENT_POINTS') {
          const err = new Error(msg)
          err.name = 'InsufficientPointsError'
          reject(err)
          return
        }
        reject(new Error(msg))
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
    })
  })
}

// 便捷方法
export const get = <T>(path: string, auth = true) =>
  request<T>(path, { method: 'GET', auth })

export const post = <T>(path: string, data?: unknown, auth = true) =>
  request<T>(path, { method: 'POST', data, auth })

export const put = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'PUT', data })

export const patch = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'PATCH', data })

export const del = <T>(path: string) =>
  request<T>(path, { method: 'DELETE' })
