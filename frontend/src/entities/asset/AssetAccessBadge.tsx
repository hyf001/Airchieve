import React from "react";

import { cn } from "@/lib/utils";

interface AssetAccessBadgeProps {
  accessLevel: "free" | "vip";
}

export const AssetAccessBadge: React.FC<AssetAccessBadgeProps> = ({ accessLevel }) => (
  <span
    className={cn(
      "inline-flex h-6 items-center rounded-full px-2 text-xs font-bold",
      accessLevel === "vip" ? "bg-[rgba(179,157,219,0.18)] text-[#7658b8]" : "bg-[rgba(139,198,168,0.2)] text-[var(--sage-deep)]",
    )}
  >
    {accessLevel === "vip" ? "VIP" : "免费"}
  </span>
);
