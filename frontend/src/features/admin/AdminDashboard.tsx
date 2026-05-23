import React from "react";
import { Activity, Boxes, FileClock, ShieldAlert } from "lucide-react";

import { adminApi } from "./api";
import type { AdminContentOverviewRead, AdminDashboardRead } from "./types";
import { LoadingSpinner } from "@/shared/ui/loading";
import { useToast } from "@/shared/ui/toast";

export const AdminDashboard: React.FC = () => {
  const [dashboard, setDashboard] = React.useState<AdminDashboardRead | null>(null);
  const [overview, setOverview] = React.useState<AdminContentOverviewRead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  React.useEffect(() => {
    Promise.all([adminApi.getDashboard().then(setDashboard), adminApi.getContentOverview().then(setOverview)])
      .catch((error) => showToast(error instanceof Error ? error.message : "后台概览加载失败", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading || !dashboard || !overview) {
    return <LoadingSpinner label="加载后台概览..." />;
  }

  const topMetrics = [
    ["待审核", dashboard.pending_moderation_count, ShieldAlert],
    ["举报", dashboard.report_count, Activity],
    ["审计日志", dashboard.audit_log_count, FileClock],
    ["内容资产", overview.stories + overview.books + overview.templates, Boxes],
  ] as const;

  const contentMetrics = [
    ["故事", overview.stories],
    ["绘本", overview.books],
    ["模板", overview.templates],
    ["角色", overview.characters],
    ["声音", overview.voices],
    ["分享", overview.share_links],
    ["导出", overview.export_jobs],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {topMetrics.map(([label, value, Icon]) => (
          <div key={label} className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-light)]">{label}</span>
              <Icon className="h-4 w-4 text-[var(--terracotta)]" />
            </div>
            <p className="mt-3 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-4">
        <h3 className="font-display text-2xl">内容概览</h3>
        <div className="mt-4 grid grid-cols-7 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
          {contentMetrics.map(([label, value]) => (
            <div key={label} className="rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.1)] p-3">
              <p className="text-xs font-bold text-[var(--text-light)]">{label}</p>
              <p className="mt-1 text-xl font-black">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
