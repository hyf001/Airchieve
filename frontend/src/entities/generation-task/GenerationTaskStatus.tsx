import React from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GenerationTaskRead } from "./types";

interface GenerationTaskStatusProps {
  task: GenerationTaskRead | null;
  onRetry?: (task: GenerationTaskRead) => void;
}

const statusLabel: Record<GenerationTaskRead["status"], string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "生成失败",
  canceled: "已取消",
};

export const GenerationTaskStatus: React.FC<GenerationTaskStatusProps> = ({ task, onRetry }) => {
  if (!task) {
    return null;
  }

  const isDone = task.status === "succeeded";
  const isFailed = task.status === "failed";

  return (
    <section className="app-card p-4">
      <div className="flex items-start gap-3">
        {isDone ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--sage-deep)]" />
        ) : isFailed ? (
          <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--terracotta)]" />
        ) : (
          <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-[var(--sky-deep)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[var(--text-dark)]">{statusLabel[task.status]}</h2>
            <span className="text-xs font-semibold text-[var(--text-light)]">{task.progress_percent}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-[rgba(212,114,92,0.08)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(135deg,var(--sage),var(--sky))] transition-all"
              style={{ width: `${task.progress_percent}%` }}
            />
          </div>
          {task.error_message ? <p className="mt-2 text-xs text-[var(--terracotta)]">{task.error_message}</p> : null}
        </div>
        {task.retryable && onRetry ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => onRetry(task)}>
            <RotateCcw className="h-3.5 w-3.5" />
            重试
          </Button>
        ) : null}
      </div>
    </section>
  );
};
