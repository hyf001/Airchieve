import React from "react";
import { Edit3, Plus, Save, Tags, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { taxonomyApi } from "@/entities/taxonomy/api";
import type { TaxonomyItem, TaxonomyItemStatus, TaxonomyItemWrite, TaxonomyType } from "@/entities/taxonomy";
import { cn } from "@/lib/utils";
import { useToast } from "@/shared/ui/toast";

const taxonomyTypes: Array<{ type: TaxonomyType; label: string; desc: string }> = [
  { type: "character_category", label: "角色分类", desc: "系统角色和自定义角色的业务分类" },
  { type: "asset_category", label: "素材分类", desc: "角色、声音、画风等素材归类" },
  { type: "age_range", label: "年龄段", desc: "绘本、故事、角色适龄范围" },
  { type: "theme", label: "主题", desc: "绘本和故事主题筛选" },
  { type: "interest_tag", label: "兴趣标签", desc: "儿童档案和推荐偏好" },
  { type: "education_goal", label: "教育目标", desc: "习惯、情绪、认知等目标" },
  { type: "reading_level", label: "阅读水平", desc: "阅读难度和能力分层" },
  { type: "language", label: "语言", desc: "内容语言选项" },
  { type: "narrative_style", label: "叙事风格", desc: "睡前、冒险、科普等风格" },
  { type: "scene", label: "场景", desc: "推荐和创作场景" },
];

interface TaxonomyFormState {
  code: string;
  name: string;
  name_en: string;
  description: string;
  sort_order: string;
}

const emptyForm: TaxonomyFormState = {
  code: "",
  name: "",
  name_en: "",
  description: "",
  sort_order: "0",
};

const toForm = (item: TaxonomyItem): TaxonomyFormState => ({
  code: item.code,
  name: item.name,
  name_en: item.name_en ?? "",
  description: item.description ?? "",
  sort_order: String(item.sort_order),
});

const toPayload = (type: TaxonomyType, form: TaxonomyFormState): TaxonomyItemWrite => ({
  type,
  code: form.code.trim(),
  name: form.name.trim(),
  name_en: form.name_en.trim() || null,
  description: form.description.trim() || null,
  metadata: null,
  sort_order: Number(form.sort_order) || 0,
});

export const AdminTaxonomyManager: React.FC = () => {
  const [type, setType] = React.useState<TaxonomyType>("character_category");
  const [items, setItems] = React.useState<TaxonomyItem[]>([]);
  const [form, setForm] = React.useState<TaxonomyFormState>(emptyForm);
  const [editingItem, setEditingItem] = React.useState<TaxonomyItem | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const { showToast } = useToast();

  const currentType = taxonomyTypes.find((item) => item.type === type) ?? taxonomyTypes[0];

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await taxonomyApi.list(type, true);
      setItems(response);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "分类加载失败", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast, type]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: TaxonomyItem) => {
    setEditingItem(item);
    setForm(toForm(item));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(false);
  };

  const updateForm = <K extends keyof TaxonomyFormState>(key: K, value: TaxonomyFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(type, form);
    if (!payload.code || !payload.name) {
      showToast("请填写编码和名称", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (editingItem) {
        await taxonomyApi.update(editingItem.id, payload);
        showToast("分类项已更新", "success");
      } else {
        await taxonomyApi.create(payload);
        showToast("分类项已创建", "success");
      }
      closeDialog();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "分类保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (item: TaxonomyItem, status: TaxonomyItemStatus) => {
    try {
      await taxonomyApi.updateStatus(item.id, status);
      showToast(status === "active" ? "分类项已启用" : "分类项已停用", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "状态更新失败", "error");
    }
  };

  return (
    <>
      <section className="grid grid-cols-[280px_1fr] gap-5 max-lg:grid-cols-1">
        <aside className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-4">
          <div className="mb-4 flex items-center gap-2">
            <Tags className="h-5 w-5 text-[var(--terracotta)]" />
            <h2 className="font-display text-2xl">分类配置</h2>
          </div>
          <div className="grid gap-2">
            {taxonomyTypes.map((item) => (
              <button
                key={item.type}
                type="button"
                className={cn(
                  "rounded-[var(--radius-sm)] px-3 py-2.5 text-left transition",
                  type === item.type ? "bg-[rgba(212,114,92,0.12)] text-[var(--terracotta)]" : "hover:bg-[rgba(212,114,92,0.06)]",
                )}
                onClick={() => setType(item.type)}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--text-light)]">{item.desc}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{currentType.label}</h2>
              <p className="mt-1 text-sm text-[var(--text-light)]">{currentType.desc}，code 会被业务数据稳定引用。</p>
            </div>
            <Button size="sm" type="button" variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增分类
            </Button>
          </div>

          {isLoading ? (
            <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
              正在加载分类...
            </div>
          ) : items.length ? (
            <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)]">
              <div className="grid grid-cols-[1fr_1fr_0.7fr_0.6fr_120px] gap-3 bg-[var(--cream)] px-4 py-3 text-xs font-bold text-[var(--text-light)] max-lg:hidden">
                <span>名称</span>
                <span>编码</span>
                <span>排序</span>
                <span>状态</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-[rgba(212,114,92,0.08)]">
                {items.map((item) => (
                  <article key={item.id} className="grid grid-cols-[1fr_1fr_0.7fr_0.6fr_120px] items-center gap-3 px-4 py-3 max-lg:grid-cols-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[var(--text-dark)]">{item.name}</h3>
                      <p className="mt-0.5 truncate text-xs text-[var(--text-light)]">{item.description ?? item.name_en ?? "未填写说明"}</p>
                    </div>
                    <code className="rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.12)] px-2.5 py-1 text-xs font-bold text-[var(--sky-deep)]">
                      {item.code}
                    </code>
                    <span className="text-sm font-semibold text-[var(--text-mid)]">排序 {item.sort_order}</span>
                    <span
                      className={cn(
                        "w-fit rounded-full px-2.5 py-1 text-xs font-bold",
                        item.status === "active"
                          ? "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]"
                          : "bg-[rgba(158,139,139,0.14)] text-[var(--text-light)]",
                      )}
                    >
                      {item.status === "active" ? "启用" : "停用"}
                    </span>
                    <div className="flex justify-end gap-2 max-lg:justify-start">
                      <Button aria-label={`编辑${item.name}`} size="icon" type="button" variant="ghost" onClick={() => openEdit(item)}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => void handleStatusChange(item, item.status === "active" ? "inactive" : "active")}
                      >
                        {item.status === "active" ? "停用" : "启用"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
              暂无分类项，点击右上角新增。
            </div>
          )}
        </section>
      </section>

      <EditDialog
        form={form}
        isOpen={dialogOpen}
        isSaving={isSaving}
        title={editingItem ? "编辑分类" : `新增${currentType.label}`}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onUpdate={updateForm}
      />
    </>
  );
};

const EditDialog: React.FC<{
  form: TaxonomyFormState;
  isOpen: boolean;
  isSaving: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof TaxonomyFormState>(key: K, value: TaxonomyFormState[K]) => void;
}> = ({ form, isOpen, isSaving, title, onClose, onSubmit, onUpdate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[500px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxonomy-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="taxonomy-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">维护展示名称、稳定编码和排序。</p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="编码">
                <Input value={form.code} onChange={(event) => onUpdate("code", event.target.value)} placeholder="friend" />
              </Field>
              <Field label="名称">
                <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="朋友" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="英文名">
                <Input value={form.name_en} onChange={(event) => onUpdate("name_en", event.target.value)} placeholder="Friend" />
              </Field>
              <Field label="排序">
                <Input inputMode="numeric" value={form.sort_order} onChange={(event) => onUpdate("sort_order", event.target.value)} />
              </Field>
            </div>
            <Field label="说明">
              <textarea
                className="min-h-[132px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                placeholder="前台展示或运营识别用说明"
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存分类"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
    {label}
    {children}
  </label>
);
