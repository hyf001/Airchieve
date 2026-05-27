import React from "react";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MembershipPlan } from "./types";

interface MembershipPlanCardProps {
  plan: MembershipPlan;
  currentPlanId?: number | null;
  onSubscribe?: (plan: MembershipPlan) => void;
}

const periodLabel: Record<MembershipPlan["billing_period"], string> = {
  none: "长期",
  month: "每月",
  quarter: "每季",
  year: "每年",
};

export const formatPrice = (priceCents: number, currency = "CNY") => {
  if (priceCents === 0) return "免费";
  const prefix = currency === "CNY" ? "¥" : `${currency} `;
  return `${prefix}${(priceCents / 100).toFixed(0)}`;
};

export const MembershipPlanCard: React.FC<MembershipPlanCardProps> = ({ plan, currentPlanId, onSubscribe }) => {
  const config = plan.entitlement_config;
  const isCurrent = currentPlanId === plan.id;
  return (
    <article className="app-card flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">{plan.name}</h3>
          <p className="mt-1 min-h-10 text-sm text-[var(--text-light)]">{plan.description}</p>
        </div>
        {config.access_level === "member" ? <Sparkles className="h-5 w-5 text-[var(--honey)]" /> : null}
      </div>
      <div className="mt-5 flex items-end gap-2">
        <span className="text-4xl font-black text-[var(--terracotta)]">{formatPrice(plan.price_cents, plan.currency)}</span>
        <span className="pb-2 text-sm text-[var(--text-light)]">{periodLabel[plan.billing_period]}</span>
      </div>
      <ul className="mt-5 grid gap-2 text-sm text-[var(--text-mid)]">
        <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-[var(--sage-deep)]" />绘本生成 {config.book_generation_monthly_limit} 次/月</li>
        <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-[var(--sage-deep)]" />分享 {config.share_monthly_limit >= 9999 ? "不限量" : `${config.share_monthly_limit} 次/月`}</li>
        <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-[var(--sage-deep)]" />PDF 导出 {config.pdf_export_monthly_limit} 次/月</li>
        <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-[var(--sage-deep)]" />{config.vip_asset_enabled ? "可用 VIP 素材" : "基础素材权益"}</li>
      </ul>
      <Button className="mt-6 w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent} onClick={() => onSubscribe?.(plan)}>
        {isCurrent ? "当前方案" : "订阅"}
      </Button>
    </article>
  );
};
