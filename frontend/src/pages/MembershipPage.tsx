import React, { useEffect, useState } from "react";
import { Crown, ShieldCheck } from "lucide-react";

import { EntitlementList, MembershipPlanCard, type MembershipPlan, type UserEntitlements, type UserMembership } from "@/entities/membership";
import { PaymentRecordList, PaymentStatusPanel, type PaymentOrder, type PaymentRecord } from "@/entities/payment";
import { membershipApi } from "@/features/membership";
import { paymentApi } from "@/features/payment";
import { AppShell } from "@/shared/layout/AppShell";
import { LoadingSpinner } from "@/shared/ui/loading";
import { useToast } from "@/shared/ui/toast";

export const MembershipPage: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [membership, setMembership] = useState<UserMembership | null>(null);
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([
      membershipApi.listPlans().then(setPlans).catch(() => setPlans([])),
      membershipApi.getMe().then(setMembership).catch(() => setMembership(null)),
      membershipApi.getEntitlements().then(setEntitlements).catch(() => setEntitlements(null)),
      paymentApi.listRecords().then(setRecords).catch(() => setRecords([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubscribe = async (plan: MembershipPlan) => {
    try {
      const nextOrder = await paymentApi.createMembershipOrder(plan.id);
      setOrder(nextOrder);
      showToast("订单已创建，请在支付渠道完成支付", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "创建订单失败", "error");
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1320px] px-8 py-8 max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">会员订阅</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">统一查看套餐、当前权益、支付状态和订阅记录。</p>
          </div>
          <div className="rounded-full bg-[rgba(245,166,35,0.14)] px-4 py-2 text-sm font-semibold text-[var(--terracotta)]">
            {membership?.plan.name ?? "未登录"}
          </div>
        </div>

        {loading ? (
          <div className="py-16"><LoadingSpinner label="加载会员信息..." /></div>
        ) : (
          <>
            <section className="mt-6 grid grid-cols-[0.9fr_1.1fr] gap-5 max-lg:grid-cols-1">
              <div className="app-card p-5">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-[var(--honey)]" />
                  <h2 className="font-display text-2xl">当前权益</h2>
                </div>
                {entitlements ? <div className="mt-4"><EntitlementList entitlements={entitlements} /></div> : <p className="mt-4 text-sm text-[var(--text-light)]">登录后可查看权益。</p>}
              </div>
              <div className="app-card p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[var(--sage-deep)]" />
                  <h2 className="font-display text-2xl">权益说明</h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[var(--text-mid)] max-sm:grid-cols-1">
                  <div className="rounded-[var(--radius-sm)] bg-[rgba(139,198,168,0.12)] p-3">会员绘本与 VIP 素材由后端权益统一判断。</div>
                  <div className="rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.1)] p-3">分享和 PDF 导出使用月度额度扣减。</div>
                  <div className="rounded-[var(--radius-sm)] bg-[rgba(245,166,35,0.12)] p-3">支付成功以后端回调和订单查询为准。</div>
                  <div className="rounded-[var(--radius-sm)] bg-[rgba(212,114,92,0.1)] p-3">儿童播放主流程不展示购买入口。</div>
                </div>
                <div className="mt-4"><PaymentStatusPanel order={order} /></div>
              </div>
            </section>

            <section className="mt-8 grid grid-cols-3 gap-5 max-lg:grid-cols-1">
              {plans.map((plan) => (
                <MembershipPlanCard key={plan.id} plan={plan} currentPlanCode={membership?.plan.code} onSubscribe={handleSubscribe} />
              ))}
            </section>

            <section className="mt-8 pb-10">
              <h2 className="mb-4 font-display text-2xl">支付记录</h2>
              <PaymentRecordList records={records} />
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
};
