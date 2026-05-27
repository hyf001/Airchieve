import React from "react";
import { Crown, Edit3, Plus, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BillingPeriod, EntitlementAccessLevel, EntitlementConfig, MembershipPlan, MembershipPlanStatus, PdfExportQuality } from "@/entities/membership";
import { cn } from "@/lib/utils";
import { useToast } from "@/shared/ui/toast";

import { adminApi } from "./api";
import type { MembershipPlanWrite } from "./types";

type NumberKey =
  | "child_profile_limit"
  | "story_limit"
  | "character_limit"
  | "voice_limit"
  | "share_monthly_limit"
  | "book_generation_monthly_limit"
  | "pdf_export_monthly_limit";

interface MembershipPlanFormState {
  name: string;
  description: string;
  price_cents: string;
  currency: string;
  billing_period: BillingPeriod;
  sort_order: string;
  status: MembershipPlanStatus;
  entitlement_config: EntitlementConfig;
}

const defaultEntitlements: EntitlementConfig = {
  access_level: "free",
  book_access_level: "free",
  child_profile_limit: 1,
  story_limit: 20,
  character_limit: 3,
  voice_limit: 1,
  share_monthly_limit: 5,
  book_generation_monthly_limit: 0,
  pdf_export_monthly_limit: 0,
  vip_asset_enabled: false,
  pdf_export_quality: "standard",
};

const emptyForm: MembershipPlanFormState = {
  name: "",
  description: "",
  price_cents: "0",
  currency: "CNY",
  billing_period: "month",
  sort_order: "0",
  status: "active",
  entitlement_config: defaultEntitlements,
};

const billingPeriodLabels: Record<BillingPeriod, string> = {
  none: "无周期",
  month: "月付",
  quarter: "季付",
  year: "年付",
};

const numberFields: Array<{ key: NumberKey; label: string; hint: string }> = [
  { key: "child_profile_limit", label: "儿童档案", hint: "可创建档案数" },
  { key: "story_limit", label: "故事资产", hint: "故事保存上限" },
  { key: "character_limit", label: "角色素材", hint: "自定义角色上限" },
  { key: "voice_limit", label: "声音素材", hint: "自定义声音上限" },
  { key: "share_monthly_limit", label: "分享次数", hint: "每月分享上限" },
  { key: "book_generation_monthly_limit", label: "绘本生成", hint: "每月生成额度" },
  { key: "pdf_export_monthly_limit", label: "PDF 导出", hint: "每月导出额度" },
];

const formatPrice = (priceCents: number, currency: string) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(priceCents / 100);

const toForm = (plan: MembershipPlan): MembershipPlanFormState => ({
  name: plan.name,
  description: plan.description ?? "",
  price_cents: String(plan.price_cents),
  currency: plan.currency,
  billing_period: plan.billing_period,
  sort_order: String(plan.sort_order),
  status: plan.status,
  entitlement_config: { ...defaultEntitlements, ...plan.entitlement_config },
});

const toPayload = (form: MembershipPlanFormState): MembershipPlanWrite => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  price_cents: Math.max(0, Number(form.price_cents) || 0),
  currency: form.currency.trim().toUpperCase() || "CNY",
  billing_period: form.billing_period,
  entitlement_config: form.entitlement_config,
  sort_order: Number(form.sort_order) || 0,
  status: form.status,
});

export const AdminMembershipManager: React.FC = () => {
  const [plans, setPlans] = React.useState<MembershipPlan[]>([]);
  const [form, setForm] = React.useState<MembershipPlanFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const { showToast } = useToast();

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setPlans(await adminApi.listMembershipPlans());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "权益列表加载失败", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, entitlement_config: { ...defaultEntitlements } });
    setDialogOpen(true);
  };

  const openEdit = (plan: MembershipPlan) => {
    setEditingId(plan.id);
    setForm(toForm(plan));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    resetDialog();
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm, entitlement_config: { ...defaultEntitlements } });
  };

  const updateForm = <K extends keyof MembershipPlanFormState>(key: K, value: MembershipPlanFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateEntitlement = <K extends keyof EntitlementConfig>(key: K, value: EntitlementConfig[K]) => {
    setForm((current) => ({
      ...current,
      entitlement_config: { ...current.entitlement_config, [key]: value },
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.name) {
      showToast("请填写套餐名称", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await adminApi.updateMembershipPlan(editingId, payload);
        showToast("权益套餐已更新", "success");
      } else {
        await adminApi.createMembershipPlan(payload);
        showToast("权益套餐已创建", "success");
      }
      resetDialog();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "权益套餐保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (plan: MembershipPlan) => {
    const nextStatus: MembershipPlanStatus = plan.status === "active" ? "inactive" : "active";
    try {
      await adminApi.updateMembershipPlanStatus(plan.id, nextStatus, nextStatus === "active" ? "后台启用套餐" : "后台停用套餐");
      showToast(nextStatus === "active" ? "套餐已启用" : "套餐已停用", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "套餐状态更新失败", "error");
    }
  };

  return (
    <>
      <section className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">权益管理</h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">维护会员套餐、价格周期、资源额度和高级能力开关。</p>
          </div>
          <Button size="sm" type="button" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增套餐
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            正在加载权益套餐...
          </div>
        ) : plans.length ? (
          <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)]">
            <div className="grid grid-cols-[1.15fr_0.7fr_0.7fr_1.25fr_0.55fr_140px] gap-3 bg-[var(--cream)] px-4 py-3 text-xs font-bold text-[var(--text-light)] max-xl:hidden">
              <span>套餐</span>
              <span>价格</span>
              <span>周期</span>
              <span>核心权益</span>
              <span>状态</span>
              <span className="text-right">操作</span>
            </div>
            <div className="divide-y divide-[rgba(212,114,92,0.08)]">
              {plans.map((plan) => (
                <article key={plan.id} className="grid grid-cols-[1.15fr_0.7fr_0.7fr_1.25fr_0.55fr_140px] items-center gap-3 px-4 py-4 max-xl:grid-cols-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-[var(--text-dark)]">{plan.name}</h3>
                      {plan.entitlement_config.vip_asset_enabled ? <Crown className="h-4 w-4 text-[var(--peach)]" /> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-light)]">排序 {plan.sort_order}</p>
                  </div>
                  <span className="text-sm font-black text-[var(--text-dark)]">{formatPrice(plan.price_cents, plan.currency)}</span>
                  <span className="text-sm font-semibold text-[var(--text-mid)]">{billingPeriodLabels[plan.billing_period]}</span>
                  <div className="flex flex-wrap gap-1.5">
                    <MetricTag label="绘本生成" value={plan.entitlement_config.book_generation_monthly_limit} />
                    <MetricTag label="PDF" value={plan.entitlement_config.pdf_export_monthly_limit} />
                    <MetricTag label="分享" value={plan.entitlement_config.share_monthly_limit} />
                  </div>
                  <StatusBadge status={plan.status} />
                  <div className="flex justify-end gap-2 max-xl:justify-start">
                    <Button aria-label={`编辑${plan.name}`} size="icon" type="button" variant="ghost" onClick={() => openEdit(plan)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" type="button" variant="ghost" onClick={() => void handleStatusChange(plan)}>
                      {plan.status === "active" ? "停用" : "启用"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            暂无权益套餐，点击右上角新增。
          </div>
        )}
      </section>

      <EditDialog
        form={form}
        isOpen={dialogOpen}
        isSaving={isSaving}
        title={editingId ? "编辑权益套餐" : "新增权益套餐"}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onUpdate={updateForm}
        onUpdateEntitlement={updateEntitlement}
      />
    </>
  );
};

const MetricTag: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <span className="rounded-full bg-[rgba(126,200,227,0.12)] px-2.5 py-1 text-xs font-bold text-[var(--sky-deep)]">
    {label} {value}
  </span>
);

const StatusBadge: React.FC<{ status: MembershipPlanStatus }> = ({ status }) => (
  <span
    className={cn(
      "w-fit rounded-full px-2.5 py-1 text-xs font-bold",
      status === "active" ? "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]" : "bg-[rgba(158,139,139,0.14)] text-[var(--text-light)]",
    )}
  >
    {status === "active" ? "启用" : "停用"}
  </span>
);

const EditDialog: React.FC<{
  form: MembershipPlanFormState;
  isOpen: boolean;
  isSaving: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof MembershipPlanFormState>(key: K, value: MembershipPlanFormState[K]) => void;
  onUpdateEntitlement: <K extends keyof EntitlementConfig>(key: K, value: EntitlementConfig[K]) => void;
}> = ({ form, isOpen, isSaving, title, onClose, onSubmit, onUpdate, onUpdateEntitlement }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[720px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="membership-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑套餐展示信息、计费周期和权益额度。</p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5">
            <div className="grid gap-3">
              <Field label="套餐名称">
                <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="成长会员" />
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              <Field label="价格（分）">
                <Input inputMode="numeric" value={form.price_cents} onChange={(event) => onUpdate("price_cents", event.target.value)} />
              </Field>
              <Field label="币种">
                <Input maxLength={3} value={form.currency} onChange={(event) => onUpdate("currency", event.target.value)} />
              </Field>
              <Field label="计费周期">
                <Select value={form.billing_period} onChange={(value) => onUpdate("billing_period", value as BillingPeriod)}>
                  {Object.entries(billingPeriodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="排序">
                <Input inputMode="numeric" value={form.sort_order} onChange={(event) => onUpdate("sort_order", event.target.value)} />
              </Field>
            </div>
            <Field label="说明">
              <textarea
                className="min-h-[88px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                placeholder="前台展示和运营识别用说明"
              />
            </Field>

            <div>
              <h3 className="text-sm font-black text-[var(--text-dark)]">权益额度</h3>
              <div className="mt-3 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {numberFields.map((item) => (
                  <Field key={item.key} label={item.label} hint={item.hint}>
                    <Input
                      inputMode="numeric"
                      min={0}
                      type="number"
                      value={form.entitlement_config[item.key]}
                      onChange={(event) => onUpdateEntitlement(item.key, Math.max(0, Number(event.target.value) || 0))}
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="账号访问级别">
                <Select value={form.entitlement_config.access_level} onChange={(value) => onUpdateEntitlement("access_level", value as EntitlementAccessLevel)}>
                  <option value="free">免费</option>
                  <option value="member">会员</option>
                </Select>
              </Field>
              <Field label="绘本访问级别">
                <Select
                  value={form.entitlement_config.book_access_level}
                  onChange={(value) => onUpdateEntitlement("book_access_level", value as EntitlementAccessLevel)}
                >
                  <option value="free">免费</option>
                  <option value="member">会员</option>
                </Select>
              </Field>
              <Field label="PDF 清晰度">
                <Select
                  value={form.entitlement_config.pdf_export_quality}
                  onChange={(value) => onUpdateEntitlement("pdf_export_quality", value as PdfExportQuality)}
                >
                  <option value="standard">标准</option>
                  <option value="hd">高清</option>
                </Select>
              </Field>
              <Field label="套餐状态">
                <Select value={form.status} onChange={(value) => onUpdate("status", value as MembershipPlanStatus)}>
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </Select>
              </Field>
            </div>

            <label className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-[rgba(255,138,101,0.08)] px-3.5 py-3 text-sm font-bold text-[var(--text-dark)]">
              <input
                checked={form.entitlement_config.vip_asset_enabled}
                className="h-4 w-4 accent-[var(--terracotta)]"
                type="checkbox"
                onChange={(event) => onUpdateEntitlement("vip_asset_enabled", event.target.checked)}
              />
              开启会员专属素材权限
            </label>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存权益套餐"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<{ children: React.ReactNode; hint?: string; label: string }> = ({ children, hint, label }) => (
  <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
    <span>{label}</span>
    {children}
    {hint ? <span className="text-xs font-medium text-[var(--text-light)]">{hint}</span> : null}
  </label>
);

const Select: React.FC<{
  children: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}> = ({ children, value, onChange }) => (
  <select
    className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm text-[var(--text-dark)] outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
    value={value}
    onChange={(event) => onChange(event.target.value)}
  >
    {children}
  </select>
);
