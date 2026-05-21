import React from "react";
import { Check, EyeOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/shared/ui/loading";
import { useToast } from "@/shared/ui/toast";
import { moderationApi } from "./api";
import type { ModerationRecord, ModerationStatus } from "./types";

const statusLabels: Record<ModerationStatus, string> = {
  pending: "待审核",
  approved: "通过",
  rejected: "驳回",
  hidden: "隐藏",
};

export const ModerationQueue: React.FC = () => {
  const [records, setRecords] = React.useState<ModerationRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  const load = React.useCallback(() => {
    setLoading(true);
    moderationApi
      .listRecords({ limit: 50 })
      .then((result) => setRecords(result.items))
      .catch((error) => showToast(error instanceof Error ? error.message : "审核队列加载失败", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  React.useEffect(load, [load]);

  const handleDecision = async (record: ModerationRecord, status: ModerationStatus) => {
    const reason = status === "approved" ? "审核通过" : status === "hidden" ? "内容存在风险，已隐藏" : "内容不符合规范";
    try {
      await moderationApi.handleRecord(record.id, { status, reason });
      showToast("审核处理已记录", "success");
      load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "审核处理失败", "error");
    }
  };

  if (loading) {
    return <LoadingSpinner label="加载审核队列..." />;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white">
      <div className="grid grid-cols-[1.1fr_1fr_0.8fr_1fr] gap-3 border-b border-[rgba(212,114,92,0.08)] px-4 py-3 text-xs font-bold text-[var(--text-light)] max-lg:hidden">
        <span>目标</span>
        <span>摘要</span>
        <span>状态</span>
        <span>处理</span>
      </div>
      {records.length === 0 ? (
        <div className="px-4 py-8 text-sm text-[var(--text-light)]">暂无审核记录。</div>
      ) : (
        records.map((record) => (
          <div key={record.id} className="grid grid-cols-[1.1fr_1fr_0.8fr_1fr] gap-3 border-b border-[rgba(212,114,92,0.06)] px-4 py-3 text-sm last:border-0 max-lg:grid-cols-1">
            <div className="font-semibold text-[var(--text-dark)]">{record.target_type} #{record.target_id}</div>
            <div className="min-w-0 text-[var(--text-mid)]">
              <p className="truncate font-medium">{record.snapshot.title ?? "未命名内容"}</p>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-light)]">{record.reason ?? record.snapshot.summary ?? "无说明"}</p>
            </div>
            <div>
              <span className="rounded-full bg-[rgba(126,200,227,0.12)] px-3 py-1 text-xs font-bold text-[var(--text-mid)]">{statusLabels[record.status]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="sage" onClick={() => handleDecision(record, "approved")}>
                <Check className="h-3.5 w-3.5" />
                通过
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDecision(record, "rejected")}>
                <X className="h-3.5 w-3.5" />
                驳回
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDecision(record, "hidden")}>
                <EyeOff className="h-3.5 w-3.5" />
                隐藏
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
