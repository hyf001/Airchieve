export type PaymentProvider = "wechat" | "alipay" | "app_store" | "manual";
export type PaymentOrderStatus = "pending" | "paid" | "failed" | "canceled" | "refunded";
export type PaymentEventType = "paid" | "failed" | "refunded" | "canceled";

export interface PaymentOrder {
  id: number;
  order_no: string;
  user_id: number;
  plan_id: number;
  amount_cents: number;
  currency: string;
  provider: PaymentProvider;
  status: PaymentOrderStatus;
  provider_order_id: string | null;
  payment_params: {
    provider: PaymentProvider;
    order_no: string;
    amount_cents: number;
    currency: string;
    nonce: string;
  } | null;
  paid_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: number;
  order_id: number;
  order_no: string;
  provider: PaymentProvider;
  event_type: PaymentEventType;
  amount_cents: number;
  occurred_at: string;
}
