import React from "react";
import { BarChart3, BookOpen, Flag, Heart, Share2, Sparkles } from "lucide-react";

import { analyticsApi } from "./api";
import type { OperationDashboard } from "./types";
import { LoadingSpinner } from "@/shared/ui/loading";
import { useToast } from "@/shared/ui/toast";

const metricIcons = {
  play_count: BookOpen,
  complete_count: BarChart3,
  favorite_count: Heart,
  share_count: Share2,
  creation_count: Sparkles,
  report_count: Flag,
};

export const AnalyticsDashboard: React.FC = () => {
  const [dashboard, setDashboard] = React.useState<OperationDashboard | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  React.useEffect(() => {
    analyticsApi
      .getDashboard()
      .then(setDashboard)
      .catch((error) => showToast(error instanceof Error ? error.message : "统计数据加载失败", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading || !dashboard) {
    return <LoadingSpinner label="加载运营统计..." />;
  }

  const metrics = [
    ["播放量", dashboard.play_count, metricIcons.play_count],
    ["完播量", dashboard.complete_count, metricIcons.complete_count],
    ["收藏量", dashboard.favorite_count, metricIcons.favorite_count],
    ["分享量", dashboard.share_count, metricIcons.share_count],
    ["创作转化", dashboard.creation_count, metricIcons.creation_count],
    ["举报数量", dashboard.report_count, metricIcons.report_count],
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
      {metrics.map(([label, value, Icon]) => (
        <div key={label} className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text-light)]">{label}</p>
            <Icon className="h-4 w-4 text-[var(--terracotta)]" />
          </div>
          <p className="mt-3 text-3xl font-black text-[var(--text-dark)]">{value}</p>
        </div>
      ))}
    </div>
  );
};
