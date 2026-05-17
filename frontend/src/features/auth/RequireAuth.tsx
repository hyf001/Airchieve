import React from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { AppLink } from "@/shared/ui/AppLink";
import { LoadingSpinner } from "@/shared/ui/loading";

interface RequireAuthProps {
  children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <LoadingSpinner label="正在确认登录状态" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-[760px] px-8 py-16 max-sm:px-4">
        <section className="app-card p-8 text-center max-sm:p-6">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)]">
            <LockKeyhole className="h-7 w-7" />
          </span>
          <h1 className="font-display mb-3 text-[34px] max-sm:text-[28px]">请先登录</h1>
          <p className="mx-auto mb-7 max-w-[460px] text-sm text-[var(--text-mid)]">
            儿童档案属于当前家长账号。登录后可以管理孩子档案、阅读历史、默认形象、声音和画风。
          </p>
          <Button asChild size="lg">
            <AppLink to="/auth">去登录或注册</AppLink>
          </Button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
};
