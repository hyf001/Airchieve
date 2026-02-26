import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  clearAuth, getMe, getStoredToken, getStoredUser, saveAuth,
  type UserOut,
} from '../services/authService';

// ============ Types ============

interface AuthState {
  user: UserOut | null;
  token: string | null;
  isLoading: boolean;   // 初始化时验证 token
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  /** 登录成功后调用：持久化 token 和 user */
  login: (token: string, user: UserOut) => void;
  /** 登出：清除本地存储并重置状态 */
  logout: () => void;
  /** 刷新当前用户信息（积分变化后调用） */
  refreshUser: () => Promise<void>;
}

// ============ Context ============

const AuthContext = createContext<AuthContextValue | null>(null);

// ============ Provider ============

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<UserOut | null>(getStoredUser());
  const [token, setToken]     = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  // 启动时验证本地 token 是否仍然有效
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }

    getMe(stored)
      .then((freshUser) => {
        setUser(freshUser);
        setToken(stored);
        saveAuth(stored, freshUser);
      })
      .catch(() => {
        // token 过期或无效，清除
        clearAuth();
        setUser(null);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((newToken: string, newUser: UserOut) => {
    saveAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const fresh = await getMe(token);
      setUser(fresh);
      saveAuth(token, fresh);
    } catch {
      logout();
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ============ Hook ============

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
