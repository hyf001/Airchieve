import React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/shared/ui/toast";
import { exportApi } from "./api";
import type { ExportJob } from "./types";

export const ExportHistoryList: React.FC<{ jobs: ExportJob[] }> = ({ jobs }) => {
  const { showToast } = useToast();

  const handleDownload = async (job: ExportJob) => {
    try {
      const file = await exportApi.getFileUrl(job.id);
      window.location.href = file.file_url;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "获取下载链接失败", "error");
    }
  };

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white">
      {jobs.length ? jobs.map((job) => (
        <div key={job.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[rgba(212,114,92,0.06)] px-4 py-3 last:border-b-0 max-sm:grid-cols-1">
          <div>
            <div className="font-semibold text-[var(--text-dark)]">{typeof job.book_snapshot.title === "string" ? job.book_snapshot.title : `绘本 #${job.book_id}`}</div>
            <div className="text-xs text-[var(--text-light)]">{new Date(job.created_at).toLocaleString()} · {job.status}</div>
          </div>
          {job.status === "succeeded" ? (
            <Button size="sm" variant="outline" onClick={() => void handleDownload(job)}>
              <Download className="h-3.5 w-3.5" />
              下载
            </Button>
          ) : (
            <div className="text-sm text-[var(--text-mid)]">{job.status}</div>
          )}
        </div>
      )) : <div className="px-4 py-6 text-sm text-[var(--text-light)]">暂无导出记录。</div>}
    </div>
  );
};
