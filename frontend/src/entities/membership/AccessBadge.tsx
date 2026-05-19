import React from "react";

import { cn } from "@/lib/utils";

export const AccessBadge: React.FC<{ access: "free" | "member" | "vip" | "preview"; className?: string }> = ({ access, className }) => {
  const label = access === "free" ? "免费" : access === "preview" ? "试看" : "会员";
  return (
    <span className={cn("inline-flex rounded-full bg-[rgba(245,166,35,0.14)] px-2.5 py-1 text-xs font-semibold text-[var(--terracotta)]", className)}>
      {label}
    </span>
  );
};
