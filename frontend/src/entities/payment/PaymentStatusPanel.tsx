import React from "react";

import type { PaymentOrder } from "./types";

const statusLabel: Record<PaymentOrder["status"], string> = {
  pending: "待支付",
  paid: "已支付",
  failed: "支付失败",
  canceled: "已取消",
  refunded: "已退款",
};

export const PaymentStatusPanel: React.FC<{ order: PaymentOrder | null }> = ({ order }) => {
  if (!order) return null;
  return (
    <div className="rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.12)] bg-white px-4 py-3 text-sm">
      <div className="font-semibold text-[var(--text-dark)]">订单 {statusLabel[order.status]}</div>
      <div className="mt-1 text-[var(--text-light)]">订单号：{order.order_no}</div>
    </div>
  );
};
