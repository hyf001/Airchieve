import React, { useEffect, useMemo, useState } from "react";
import { Check, Edit3, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArtStyle } from "@/entities/asset";
import { TaxonomyMultiSelect, useTaxonomyGroup } from "@/entities/taxonomy";
import { artStyleLibraryApi, type CustomArtStyleWrite } from "@/features/art-style-library";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

const recommendedCode = "cartoon";
const examples = ["像宫崎骏动画的风格", "温暖的粉色调，像棉花糖", "简约北欧风", "复古拼贴画风格", "梦幻星空紫色调"];
const ageLabels: Record<string, string> = {
  age_0_2: "0-2岁",
  age_3_4: "3-4岁",
  age_5_6: "5-6岁",
  age_7_8: "7-8岁",
  age_9_10: "9-10岁",
  "0-3": "0-3岁",
  "2-4": "2-4岁",
  "3-6": "3-6岁",
  "4-6": "4-6岁",
  "6+": "6岁以上",
};

interface CustomArtStyleFormState {
  code: string;
  name: string;
  description: string;
  prompt: string;
  example_url: string;
  age_range_codes: string[];
}

const emptyCustomForm: CustomArtStyleFormState = {
  code: "",
  name: "",
  description: "",
  prompt: "",
  example_url: "",
  age_range_codes: [],
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

export const ArtStylesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"system" | "custom">("system");
  const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customForm, setCustomForm] = useState<CustomArtStyleFormState>(emptyCustomForm);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isAuthenticated } = useAuth();
  const { labelMap: ageLabelMap } = useTaxonomyGroup("age_range");
  const { showToast } = useToast();

  const systemStyles = useMemo(() => artStyles.filter((style) => style.owner_user_id === null), [artStyles]);
  const customStyles = useMemo(() => artStyles.filter((style) => style.owner_user_id !== null), [artStyles]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await artStyleLibraryApi.list();
      setArtStyles(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "画风库加载失败", "error");
      setArtStyles([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (style: ArtStyle) => {
    setSelectedId((current) => (current === style.id ? null : style.id));
    showToast(`已选择「${style.name}」画风`, "success");
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      showToast("登录后可以新增自定义画风", "error");
      return;
    }
    setEditingId(null);
    setCustomForm(emptyCustomForm);
    setPendingImageFile(null);
    setPreviewUrl("");
    setDialogOpen(true);
  };

  const openEdit = (style: ArtStyle) => {
    if (style.owner_user_id === null) return;
    setEditingId(style.id);
    setCustomForm({
      code: style.code ?? "",
      name: style.name,
      description: style.description,
      prompt: style.prompt ?? "",
      example_url: style.example_url ?? "",
      age_range_codes: style.age_range_codes,
    });
    setPendingImageFile(null);
    setPreviewUrl(style.example_url ?? "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setDialogOpen(false);
    setEditingId(null);
    setCustomForm(emptyCustomForm);
    setPendingImageFile(null);
    setPreviewUrl("");
  };

  const updateCustomForm = <K extends keyof CustomArtStyleFormState>(key: K, value: CustomArtStyleFormState[K]) => {
    if (key === "example_url") {
      setPendingImageFile(null);
      setPreviewUrl(String(value));
    }
    setCustomForm((current) => ({ ...current, [key]: value }));
  };

  const applyExample = (example: string) => {
    setCustomForm((current) => ({
      ...current,
      name: current.name || (example.length > 16 ? `${example.slice(0, 16)}...` : example),
      description: example,
      prompt: example,
    }));
  };

  const handleSelectImage = (file: File) => {
    setPendingImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmitCustom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = customForm.name.trim();
    const description = customForm.description.trim();
    if (!name || !description) {
      showToast("请填写名称和描述", "error");
      return;
    }
    if (!isAuthenticated) {
      showToast("登录后可以生成自定义画风", "error");
      return;
    }

    setIsSaving(true);
    try {
      const imagePayload = pendingImageFile
        ? {
            example_image_base64: await readFileAsDataUrl(pendingImageFile),
            example_image_mime_type: pendingImageFile.type || "image/png",
            example_image_filename: pendingImageFile.name,
          }
        : {};
      const payload: CustomArtStyleWrite = {
        code: customForm.code.trim() || null,
        name,
        description,
        prompt: customForm.prompt.trim() || description,
        example_url: pendingImageFile ? null : customForm.example_url.trim() || null,
        age_range_codes: customForm.age_range_codes,
        access_level: "free",
        sort_order: 0,
        status: "active",
        ...imagePayload,
      };
      const style = editingId ? await artStyleLibraryApi.updateCustom(editingId, payload) : await artStyleLibraryApi.createCustom(payload);
      setSelectedId(style.id);
      setCustomForm(emptyCustomForm);
      setPendingImageFile(null);
      setPreviewUrl("");
      setEditingId(null);
      setDialogOpen(false);
      await load();
      showToast(editingId ? "自定义画风已更新" : "自定义画风已创建，可在创作中使用", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义画风保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustom = async (style: ArtStyle) => {
    if (style.owner_user_id === null) return;
    if (!window.confirm(`确认删除「${style.name}」吗？`)) return;
    try {
      await artStyleLibraryApi.deleteCustom(style.id);
      if (selectedId === style.id) setSelectedId(null);
      showToast("自定义画风已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义画风删除失败", "error");
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-8 pb-12 max-sm:px-4">
        <header className="relative py-12 text-center max-sm:py-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(245,166,35,0.08),transparent_70%)]" />
          <h1 className="font-display relative text-[38px] leading-tight text-[var(--text-dark)] max-sm:text-[30px]">画风选择</h1>
          <p className="relative mx-auto mt-2 max-w-[520px] text-base leading-7 text-[var(--text-mid)]">
            选择你喜欢的画风，让绘本拥有独特的视觉风格。
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")}>
              系统画风
              <span className="rounded-full bg-[rgba(245,166,35,0.14)] px-2 py-0.5 text-xs text-[var(--honey)]">{systemStyles.length}</span>
            </TabButton>
            <TabButton active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
              自定义画风
              <span className="rounded-full bg-[rgba(139,198,168,0.16)] px-2 py-0.5 text-xs text-[var(--sage-deep)]">{customStyles.length}</span>
            </TabButton>
          </div>
        </div>

        {activeTab === "system" ? (
          <>
            <section>
              <SectionTitle title="系统画风" badge={`${systemStyles.length} 种精选`} />
              {isLoading ? (
                <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载画风库...</div>
              ) : systemStyles.length ? (
                <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
                  {systemStyles.map((style) => (
                    <StyleCard
                      key={style.id}
                      ageLabelMap={ageLabelMap}
                      selected={selectedId === style.id}
                      style={style}
                      onSelect={() => handleSelect(style)}
                    />
                  ))}
                </div>
              ) : (
                <div className="app-card p-7 text-sm text-[var(--text-light)]">画风库暂无数据，管理员配置后会展示在这里。</div>
              )}
            </section>
          </>
        ) : null}

        {activeTab === "custom" ? (
          <section id="custom-style">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="自定义画风" />
              <Button size="sm" type="button" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新增画风
              </Button>
            </div>
            {isLoading ? (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载自定义画风...</div>
            ) : customStyles.length ? (
              <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {customStyles.map((style) => (
                  <StyleCard
                    key={style.id}
                    ageLabelMap={ageLabelMap}
                    selected={selectedId === style.id}
                    style={style}
                    onDelete={() => void handleDeleteCustom(style)}
                    onEdit={() => openEdit(style)}
                    onSelect={() => handleSelect(style)}
                  />
                ))}
              </div>
            ) : (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">还没有自定义画风，点击右上角新增。</div>
            )}
          </section>
        ) : null}
      </main>
      <EditDialog
        form={customForm}
        isOpen={dialogOpen}
        isSaving={isSaving}
        previewUrl={previewUrl || customForm.example_url}
        title={editingId ? "编辑自定义画风" : "新增自定义画风"}
        onApplyExample={applyExample}
        onClose={closeDialog}
        onSelectImage={handleSelectImage}
        onSubmit={handleSubmitCustom}
        onUpdate={updateCustomForm}
      />
    </AppShell>
  );
};

const TabButton: React.FC<React.PropsWithChildren<{ active: boolean; onClick: () => void }>> = ({ active, children, onClick }) => (
  <button
    className={cn(
      "inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold transition max-sm:px-3",
      active ? "bg-[var(--terracotta)] text-white shadow-[0_3px_12px_rgba(212,114,92,0.24)]" : "text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.06)]",
    )}
    type="button"
    onClick={onClick}
  >
    {children}
  </button>
);

const SectionTitle: React.FC<{ title: string; badge?: string }> = ({ title, badge }) => (
  <h2 className="font-display mb-6 flex items-center gap-2 text-[24px] text-[var(--text-dark)]">
    {title}
    {badge ? (
      <span className="rounded-full bg-[linear-gradient(135deg,var(--honey),var(--peach))] px-2.5 py-1 text-xs font-bold text-white">
        {badge}
      </span>
    ) : null}
  </h2>
);

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
    {label}
    {children}
  </label>
);

const EditDialog: React.FC<{
  form: CustomArtStyleFormState;
  isOpen: boolean;
  isSaving: boolean;
  previewUrl: string;
  title: string;
  onApplyExample: (example: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof CustomArtStyleFormState>(key: K, value: CustomArtStyleFormState[K]) => void;
  onSelectImage: (file: File) => void;
}> = ({ form, isOpen, isSaving, previewUrl, title, onApplyExample, onClose, onSubmit, onUpdate, onSelectImage }) => {
  const inputId = React.useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[520px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-art-style-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="custom-art-style-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑个人私有画风卡片信息、示例图、年龄段和生成提示词。</p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <Field label="示例图">
              <label
                className="group relative flex min-h-[180px] cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(212,114,92,0.22)] bg-[var(--cream)] text-center transition hover:border-[var(--peach)]"
                htmlFor={inputId}
              >
                {previewUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover" src={previewUrl} /> : null}
                <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[var(--terracotta)] shadow-[var(--shadow-soft)]">
                  <ImagePlus className="h-4 w-4" />
                  {previewUrl ? "更换示例图" : "选择示例图"}
                </span>
                <input
                  id={inputId}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  disabled={isSaving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectImage(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <Input className="mt-2" value={form.example_url} onChange={(event) => onUpdate("example_url", event.target.value)} placeholder="也可以直接粘贴示例图 URL" />
            </Field>

            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="编码">
                <Input value={form.code} onChange={(event) => onUpdate("code", event.target.value)} placeholder="my-watercolor" />
              </Field>
              <Field label="名称">
                <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="水彩画风" />
              </Field>
            </div>

            <Field label="描述">
              <textarea
                className="min-h-[108px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                placeholder="前台展示描述"
              />
            </Field>

            <Field label="生成提示词">
              <textarea
                className="min-h-[132px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                value={form.prompt}
                onChange={(event) => onUpdate("prompt", event.target.value)}
                placeholder="用于 AI 生成的多行提示词"
              />
            </Field>

            <Field label="年龄段">
              <TaxonomyMultiSelect type="age_range" value={form.age_range_codes} onChange={(codes) => onUpdate("age_range_codes", codes)} />
            </Field>

            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  className="rounded-full border border-[rgba(61,44,44,0.08)] bg-white px-3.5 py-1.5 text-xs text-[var(--text-mid)] transition hover:border-[var(--honey)] hover:bg-[rgba(245,166,35,0.05)] hover:text-[var(--honey)]"
                  type="button"
                  onClick={() => onApplyExample(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存画风"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const StyleCard: React.FC<{
  ageLabelMap: Record<string, string>;
  style: ArtStyle;
  selected: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onSelect: () => void;
}> = ({ ageLabelMap, style, selected, onDelete, onEdit, onSelect }) => (
  <article
    className={cn(
      "group relative overflow-hidden rounded-[20px] border-[2.5px] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
      selected ? "border-[var(--honey)] shadow-[0_0_0_3px_rgba(245,166,35,0.15),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
    )}
  >
    {style.code === recommendedCode ? (
      <span className="absolute right-3.5 top-3.5 z-10 rounded-full bg-[linear-gradient(135deg,#FF6B6B,var(--terracotta))] px-3 py-1 text-xs font-bold text-white shadow-[0_2px_8px_rgba(212,114,92,0.3)]">
        推荐
      </span>
    ) : null}
    {onEdit || onDelete ? (
      <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
        {onEdit ? (
          <Button aria-label={`编辑${style.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button aria-label={`删除${style.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    ) : null}
    <button className="block w-full text-left" type="button" onClick={onSelect}>
      <div className="relative h-[200px] overflow-hidden bg-[linear-gradient(135deg,rgba(245,166,35,0.16),rgba(126,200,227,0.18))]">
        {style.example_url ? (
          <img alt={`${style.name}示例图`} className="h-full w-full object-cover" src={style.example_url} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-[var(--text-light)]">暂无示例图</div>
        )}
      </div>
      <span
        className={cn(
          "absolute left-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--honey),var(--peach))] text-white shadow-[0_2px_8px_rgba(245,166,35,0.3)] transition",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      >
        <Check className="h-4 w-4" />
      </span>
      <div className="p-5">
        <h3 className="font-display text-xl text-[var(--text-dark)]">{style.name}</h3>
        <p className="mt-2 min-h-[68px] text-[13px] leading-6 text-[var(--text-mid)]">{style.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {style.age_range_codes.map((code) => (
            <AgeTag key={code} code={code} label={ageLabelMap[code] ?? ageLabels[code]} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              style.access_level === "vip"
                ? "bg-[linear-gradient(135deg,rgba(245,166,35,0.15),rgba(255,138,101,0.15))] text-[var(--peach)]"
                : "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]",
            )}
          >
            {style.access_level === "vip" ? "VIP" : "免费"}
          </span>
          <span
            className={cn(
              "rounded-xl border-2 px-4 py-2 text-xs font-bold transition",
              selected
                ? "border-transparent bg-[linear-gradient(135deg,var(--honey),var(--peach))] text-white"
                : "border-[var(--honey)] text-[var(--honey)] group-hover:bg-[var(--honey)] group-hover:text-white",
            )}
          >
            {selected ? "已选择" : "选择此画风"}
          </span>
        </div>
      </div>
    </button>
  </article>
);

const AgeTag: React.FC<{ code: string; label?: string }> = ({ code, label }) => {
  const tone =
    code.includes("0") || code.includes("2")
      ? "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]"
      : code.includes("6+")
        ? "bg-[rgba(126,200,227,0.15)] text-[var(--sky-deep)]"
        : "bg-[rgba(245,166,35,0.12)] text-[var(--honey)]";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", tone)}>{label ?? code}</span>;
};
