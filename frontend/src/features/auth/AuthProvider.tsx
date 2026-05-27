import React from "react";

import { authApi, clearAuthSession, hasAuthToken, readStoredUser, type UserRead } from "@/features/auth/api";
import { useToast } from "@/shared/ui/toast";

interface AuthContextValue {
  user: UserRead | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = React.useState<UserRead | null>(() => readStoredUser());
  const [isLoading, setIsLoading] = React.useState(() => hasAuthToken());
  const { showToast } = useToast();

  const refreshUser = React.useCallback(async () => {
    if (!hasAuthToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextUser = await authApi.getMe();
      window.localStorage.setItem("airchieve.user", JSON.stringify(nextUser));
      setUser(nextUser);
    } catch {
      clearAuthSession();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = React.useCallback(async () => {
    try {
      if (hasAuthToken()) {
        await authApi.logout();
      }
    } catch {
      // Local cleanup still makes the UI consistent when the backend is offline.
    } finally {
      clearAuthSession();
      setUser(null);
      showToast("已退出登录", "success");
    }
  }, [showToast]);

  React.useEffect(() => {
    void refreshUser();
    const handleStorageChange = () => {
      setUser(readStoredUser());
      void refreshUser();
    };
    const handleAuthExpired = () => {
      clearAuthSession();
      setUser(null);
      setIsLoading(false);
      showToast("登录已过期，请重新登录", "error");
    };
    window.addEventListener("airchieve.auth.changed", handleStorageChange);
    window.addEventListener("airchieve.auth.expired", handleAuthExpired);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("airchieve.auth.changed", handleStorageChange);
      window.removeEventListener("airchieve.auth.expired", handleAuthExpired);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [refreshUser, showToast]);

  const value = React.useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && hasAuthToken()),
      isLoading,
      refreshUser,
      logout,
    }),
    [isLoading, logout, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
