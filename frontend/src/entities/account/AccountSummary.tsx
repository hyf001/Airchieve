import React from "react";
import { LogOut, MessageCircle, Phone, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";

export const AccountSummary: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <section className="app-card p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {user.avatar_url ? (
            <img alt="" className="h-12 w-12 rounded-full object-cover" src={user.avatar_url} />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--sage),var(--sky))] text-white">
              <UserRound className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold">{user.display_name}</h2>
            <p className="text-xs text-[var(--text-light)]">当前账号状态：{user.status}</p>
          </div>
        </div>
        <Button aria-label="退出登录" size="icon" variant="ghost" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-2.5 text-sm">
        <AccountStatusLine icon={<Phone className="h-4 w-4" />} label="手机号" value={user.phone_masked ?? "未绑定"} />
        <AccountStatusLine icon={<MessageCircle className="h-4 w-4" />} label="微信" value={user.wechat_bound ? "已绑定" : "未绑定"} />
        <AccountStatusLine
          icon={<ShieldCheck className="h-4 w-4" />}
          label="会员"
          value={user.membership_summary?.plan ?? "free"}
        />
      </div>
    </section>
  );
};

const AccountStatusLine: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--warm-bg)] px-3.5 py-3">
    <span className="flex items-center gap-2 text-[var(--text-mid)]">
      <span className="text-[var(--terracotta)]">{icon}</span>
      {label}
    </span>
    <span className="font-bold text-[var(--text-dark)]">{value}</span>
  </div>
);
