import React from "react";

import type { UserEntitlements } from "./types";

interface EntitlementListProps {
  entitlements: UserEntitlements;
}

const remaining = (limit: number, used: number, reserved = 0) => Math.max(0, limit - used - reserved);

export const EntitlementList: React.FC<EntitlementListProps> = ({ entitlements }) => {
  const { limits, usages } = entitlements;
  const rows = [
    ["儿童档案", `${limits.child_profile_limit} 个`],
    ["个人故事", `${limits.story_limit} 个`],
    ["个人形象", `${limits.character_limit} 个`],
    ["个人声音", `${limits.voice_limit} 个`],
    ["绘本生成", `${remaining(limits.book_generation_monthly_limit, usages.book_generation_monthly_used, usages.book_generation_monthly_reserved)} / ${limits.book_generation_monthly_limit}`],
    ["绘本分享", `${remaining(limits.share_monthly_limit, usages.share_monthly_used, usages.share_monthly_reserved)} / ${limits.share_monthly_limit}`],
    ["PDF 导出", `${remaining(limits.pdf_export_monthly_limit, usages.pdf_export_monthly_used, usages.pdf_export_monthly_reserved)} / ${limits.pdf_export_monthly_limit}`],
    ["导出清晰度", limits.pdf_export_quality === "hd" ? "高清" : "标准"],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.08)] px-4 py-3">
          <div className="text-xs text-[var(--text-light)]">{label}</div>
          <div className="mt-1 font-semibold text-[var(--text-dark)]">{value}</div>
        </div>
      ))}
    </div>
  );
};
