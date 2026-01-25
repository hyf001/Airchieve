import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';

// ============ Types ============
interface UserInfo {
  id: number;
  account: string;
  name: string;
  email: string | null;
  role: string;
}

interface AuthState {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  showLoginModal: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  login: (account: string, password: string) => Promise<void>;
  register: (account: string, password: string, name: string, email?: string) => Promise<void>;
  logout: () => void;
}

// ============ Context ============
const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'airchieve_token';
const USER_KEY = 'airchieve_user';

// ============ Provider ============
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 设置 axios 请求头
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const openLoginModal = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setShowLoginModal(false);
  }, []);

  const login = useCallback(async (account: string, password: string) => {
    const response = await api.post('/api/v1/auth/login', { account, password });
    const { access_token, user: userInfo } = response.data;

    setToken(access_token);
    setUser(userInfo);
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
    setShowLoginModal(false);
  }, []);

  const register = useCallback(async (account: string, password: string, name: string, email?: string) => {
    const response = await api.post('/api/v1/auth/register', { account, password, name, email });
    const { access_token, user: userInfo } = response.data;

    setToken(access_token);
    setUser(userInfo);
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo));
    setShowLoginModal(false);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete api.defaults.headers.common['Authorization'];
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    showLoginModal,
    openLoginModal,
    closeLoginModal,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============ Hook ============
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// 导出一个全局方法用于在 axios interceptor 中触发登录弹窗
let globalOpenLoginModal: (() => void) | null = null;

export function setGlobalOpenLoginModal(fn: () => void) {
  globalOpenLoginModal = fn;
}

export function triggerLoginModal() {
  globalOpenLoginModal?.();
}
