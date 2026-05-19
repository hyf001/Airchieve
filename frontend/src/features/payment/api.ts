import type { PaymentOrder, PaymentProvider, PaymentRecord } from "@/entities/payment";
import { apiClient } from "@/shared/api/client";

export const paymentApi = {
  createMembershipOrder: (planId: number, provider: PaymentProvider = "manual") =>
    apiClient.post<PaymentOrder>("/v1/payment/membership-orders", {
      plan_id: planId,
      provider,
      idempotency_key: crypto.randomUUID?.() ?? `membership-${planId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
  getOrder: (orderId: number) => apiClient.get<PaymentOrder>(`/v1/payment/orders/${orderId}`),
  listRecords: () => apiClient.get<PaymentRecord[]>("/v1/payment/records"),
};
