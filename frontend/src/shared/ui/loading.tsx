import React from "react";

import { cn } from "@/lib/utils";

export const LoadingSpinner: React.FC<{ className?: string; label?: string }> = ({
  className,
  label = "加载中",
}) => (
  <span className={cn("inline-flex items-center gap-2 text-sm font-bold text-[var(--terracotta)]", className)}>
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(212,114,92,0.22)] border-t-[var(--terracotta)]" />
    {label}
  </span>
);

export const LoadingOverlay: React.FC<{ show: boolean; label?: string }> = ({ show, label }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-[rgba(255,250,245,0.72)] backdrop-blur-sm">
      <div className="rounded-[var(--radius-lg)] bg-white px-6 py-5 shadow-[var(--shadow-hover)]">
        <LoadingSpinner label={label} />
      </div>
    </div>
  );
};
