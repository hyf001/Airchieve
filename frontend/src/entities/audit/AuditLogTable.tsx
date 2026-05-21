import React from "react";

import { LoadingSpinner } from "@/shared/ui/loading";
import { useToast } from "@/shared/ui/toast";
import { auditApi } from "./api";
import type { AuditLog } from "./types";

export const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { showToast } = useToast();

  React.useEffect(() => {
    auditApi
      .listLogs({ limit: 30 })
      .then((result) => setLogs(result.items))
      .catch((error) => showToast(error instanceof Error ? error.message : "审计日志加载失败", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) {
    return <LoadingSpinner label="加载审计日志..." />;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white">
      <div className="grid grid-cols-[0.8fr_1fr_1fr_1.2fr] gap-3 border-b border-[rgba(212,114,92,0.08)] px-4 py-3 text-xs font-bold text-[var(--text-light)] max-lg:hidden">
        <span>操作者</span>
        <span>动作</span>
        <span>目标</span>
        <span>原因与时间</span>
      </div>
      {logs.length === 0 ? (
        <div className="px-4 py-8 text-sm text-[var(--text-light)]">暂无审计日志。</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="grid grid-cols-[0.8fr_1fr_1fr_1.2fr] gap-3 border-b border-[rgba(212,114,92,0.06)] px-4 py-3 text-sm last:border-0 max-lg:grid-cols-1">
            <div className="font-semibold">{log.operator_type} {log.operator_id ? `#${log.operator_id}` : ""}</div>
            <div className="text-[var(--text-mid)]">{log.action}</div>
            <div className="text-[var(--text-mid)]">{log.target_type} #{log.target_id}</div>
            <div className="text-xs text-[var(--text-light)]">
              <p className="line-clamp-2">{log.reason ?? "无原因"}</p>
              <p className="mt-1">{new Date(log.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
