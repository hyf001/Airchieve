import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react'
import Taro from '@tarojs/taro'
import {
  clearAuth, getMe, getStoredToken, getStoredUser, saveAuth,
  type UserOut,
} from '../services/authService'
import { setOnUnauthorized } from '../utils/request'

// ============ Types ============

interface AuthState {
  user: UserOut | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: UserOut) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

// ============ Context ============

const AuthContext = createContext<AuthContextValue | null>(null)

// ============ Provider ============

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]   = useState<UserOut | null>(getStoredUser())
  const [token, setToken] = useState<string | null>(getStoredToken())
  const [isLoading, setIsLoading] = useState(true)

  // 401 时跳转到登录页
  useEffect(() => {
    setOnUnauthorized(() => {
      clearAuth()
      setUser(null)
      setToken(null)
      Taro.navigateTo({ url: '/pages/login/index' })
    })
  }, [])

  // 启动时验证 token
  useEffect(() => {
    const stored = getStoredToken()
    if (!stored) {
      setIsLoading(false)
      return
    }
    getMe()
      .then((freshUser) => {
        setUser(freshUser)
        setToken(stored)
        saveAuth(stored, freshUser)
      })
      .catch(() => {
        clearAuth()
        setUser(null)
        setToken(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback((newToken: string, newUser: UserOut) => {
    saveAuth(newToken, newUser)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setToken(null)
    setUser(null)
    Taro.reLaunch({ url: '/pages/login/index' })
  }, [])

  const refreshUser = useCallback(async () => {
    if (!token) return
    try {
      const fresh = await getMe()
      setUser(fresh)
      saveAuth(token, fresh)
    } catch {
      logout()
    }
  }, [token, logout])

  return (
    <AuthContext.Provider
      value={{
        user, token, isLoading,
        isAuthenticated: !!user,
        login, logout, refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ============ Hook ============

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
