import React from "react";

import type { PaymentRecord } from "./types";

const eventLabel: Record<PaymentRecord["event_type"], string> = {
  paid: "已支付",
  failed: "支付失败",
  refunded: "已退款",
  canceled: "已取消",
};

export const PaymentRecordList: React.FC<{ records: PaymentRecord[] }> = ({ records }) => (
  <div className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white">
    {records.length ? records.map((record) => (
      <div key={record.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-[rgba(212,114,92,0.06)] px-4 py-3 last:border-b-0">
        <div>
          <div className="font-semibold text-[var(--text-dark)]">{record.order_no}</div>
          <div className="text-xs text-[var(--text-light)]">{new Date(record.occurred_at).toLocaleString()}</div>
        </div>
        <div className="text-right text-sm text-[var(--text-mid)]">{eventLabel[record.event_type]}</div>
      </div>
    )) : <div className="px-4 py-6 text-sm text-[var(--text-light)]">暂无支付记录。</div>}
  </div>
);
