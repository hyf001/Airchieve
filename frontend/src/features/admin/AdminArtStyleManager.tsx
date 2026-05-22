import React from "react";
import { Edit3, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxonomyMultiSelect, useTaxonomyGroup } from "@/entities/taxonomy";
import type { ArtStyle, AssetAccessLevel } from "@/entities/asset";
import { cn } from "@/lib/utils";
import { useToast } from "@/shared/ui/toast";

import { adminApi } from "./api";
import type { SystemArtStyleWrite } from "./types";

interface ArtStyleFormState {
  code: string;
  name: string;
  description: string;
  prompt: string;
  example_asset_id: number | null;
  example_url: string;
  age_range_codes: string[];
  access_level: AssetAccessLevel;
  sort_order: string;
  status: "active" | "inactive";
}

const emptyForm: ArtStyleFormState = {
  code: "",
  name: "",
  description: "",
  prompt: "",
  example_asset_id: null,
  example_url: "",
  age_range_codes: [],
  access_level: "free",
  sort_order: "0",
  status: "active",
};

const toForm = (style: ArtStyle): ArtStyleFormState => ({
  code: style.code ?? "",
  name: style.name,
  description: style.description,
  prompt: style.prompt ?? "",
  example_asset_id: style.example_asset_id,
  example_url: style.example_url ?? "",
  age_range_codes: style.age_range_codes,
  access_level: style.access_level,
  sort_order: String(style.sort_order),
  status: style.status === "inactive" ? "inactive" : "active",
});

const toPayload = (form: ArtStyleFormState): SystemArtStyleWrite => ({
  code: form.code.trim(),
  name: form.name.trim(),
  description: form.description.trim(),
  prompt: form.prompt.trim() || null,
  example_asset_id: form.example_asset_id,
  age_range_codes: form.age_range_codes,
  access_level: form.access_level,
  sort_order: Number(form.sort_order) || 0,
  status: form.status,
});

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

export const AdminArtStyleManager: React.FC = () => {
  const [items, setItems] = React.useState<ArtStyle[]>([]);
  const [form, setForm] = React.useState<ArtStyleFormState>(emptyForm);
  const [pendingImageFile, setPendingImageFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string>("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const { labelMap: ageLabelMap } = useTaxonomyGroup("age_range");
  const { showToast } = useToast();

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listArtStyles();
      setItems(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "画风列表加载失败", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateForm = <K extends keyof ArtStyleFormState>(key: K, value: ArtStyleFormState[K]) => {
    if (key === "example_url") {
      setPendingImageFile(null);
      setPreviewUrl(String(value));
    }
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPendingImageFile(null);
    setPreviewUrl("");
    setDialogOpen(true);
  };

  const openEdit = (style: ArtStyle) => {
    setEditingId(style.id);
    setForm(toForm(style));
    setPendingImageFile(null);
    setPreviewUrl(style.example_url ?? "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving || isUploading) return;
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setPendingImageFile(null);
    setPreviewUrl("");
  };

  const handleSelectImage = (file: File) => {
    setPendingImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.code || !payload.name || !payload.description) {
      showToast("请填写编码、名称和描述", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (pendingImageFile) {
        setIsUploading(true);
        const dataUrl = await readFileAsDataUrl(pendingImageFile);
        const image = await adminApi.uploadArtStyleImage({
          base64: dataUrl,
          mime_type: pendingImageFile.type || "image/png",
          filename: pendingImageFile.name,
        });
        payload.example_asset_id = image.id;
        setIsUploading(false);
      }
      if (editingId) {
        await adminApi.updateArtStyle(editingId, payload);
        showToast("画风已更新", "success");
      } else {
        await adminApi.createArtStyle(payload);
        showToast("画风已创建", "success");
      }
      closeDialog();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "画风保存失败", "error");
    } finally {
      setIsUploading(false);
      setIsSaving(false);
    }
  };

  const handleDelete = async (style: ArtStyle) => {
    if (!window.confirm(`确认删除「${style.name}」吗？`)) return;
    try {
      await adminApi.deleteArtStyle(style.id);
      showToast("画风已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "画风删除失败", "error");
    }
  };

  return (
    <>
      <section className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">系统画风</h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">管理前台系统画风卡片，删除会从前台列表隐藏。</p>
          </div>
          <Button size="sm" type="button" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增画风
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            正在加载画风...
          </div>
        ) : items.length ? (
          <div className="mt-5 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            {items.map((style) => (
              <ArtStyleAdminCard
                key={style.id}
                ageLabelMap={ageLabelMap}
                style={style}
                onDelete={() => void handleDelete(style)}
                onEdit={() => openEdit(style)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            暂无系统画风，点击右上角新增。
          </div>
        )}
      </section>

      <EditDialog
        form={form}
        isOpen={dialogOpen}
        isSaving={isSaving}
        isUploading={isUploading}
        previewUrl={previewUrl || form.example_url}
        title={editingId ? "编辑画风" : "新增画风"}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onUpdate={updateForm}
        onSelectImage={handleSelectImage}
      />
    </>
  );
};

const ArtStyleAdminCard: React.FC<{
  ageLabelMap: Record<string, string>;
  style: ArtStyle;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ ageLabelMap, style, onDelete, onEdit }) => (
  <article className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(255,248,240,0.72)] shadow-[var(--shadow-soft)]">
    <div className="relative h-36 bg-[linear-gradient(135deg,rgba(245,166,35,0.16),rgba(126,200,227,0.18))]">
      {style.example_url ? (
        <img alt="" className="h-full w-full object-cover" src={style.example_url} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm font-bold text-[var(--text-light)]">暂无示例图</div>
      )}
      <div className="absolute right-3 top-3 flex gap-2">
        <Button aria-label={`编辑${style.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button aria-label={`删除${style.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl">{style.name}</h3>
          <p className="mt-1 text-xs font-bold text-[var(--text-light)]">{style.code ?? "未设置编码"} · 排序 {style.sort_order}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            style.access_level === "vip"
              ? "bg-[rgba(255,138,101,0.14)] text-[var(--peach)]"
              : "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]",
          )}
        >
          {style.access_level === "vip" ? "VIP" : "免费"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[44px] text-sm leading-6 text-[var(--text-mid)]">{style.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {style.age_range_codes.length ? (
          style.age_range_codes.map((code) => (
            <span key={code} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--text-mid)]">
              {ageLabelMap[code] ?? code}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--text-light)]">未配置年龄段</span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--text-light)]">
        <span>{style.status === "active" ? "启用" : "停用"}</span>
        <span>{style.example_url ? "已配置示例图" : "未配置示例图"}</span>
      </div>
    </div>
  </article>
);

const EditDialog: React.FC<{
  form: ArtStyleFormState;
  isOpen: boolean;
  isSaving: boolean;
  isUploading: boolean;
  previewUrl: string;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ArtStyleFormState>(key: K, value: ArtStyleFormState[K]) => void;
  onSelectImage: (file: File) => void;
}> = ({ form, isOpen, isSaving, isUploading, previewUrl, title, onClose, onSubmit, onUpdate, onSelectImage }) => {
  const inputId = React.useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[520px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="art-style-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="art-style-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑系统画风卡片信息、示例图、年龄段和生成提示词。</p>
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
                {previewUrl ? (
                  <img alt="" className="absolute inset-0 h-full w-full object-cover" src={previewUrl} />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[var(--terracotta)] shadow-[var(--shadow-soft)]">
                  <ImagePlus className="h-4 w-4" />
                  {previewUrl ? "更换示例图" : "选择示例图"}
                </span>
                <input
                  id={inputId}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectImage(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <Input
                className="mt-2"
                value={form.example_url}
                onChange={(event) => onUpdate("example_url", event.target.value)}
                placeholder="也可以直接粘贴示例图 URL"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="编码">
                <Input value={form.code} onChange={(event) => onUpdate("code", event.target.value)} placeholder="watercolor" />
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

            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <Field label="权益">
                <select
                  className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm"
                  value={form.access_level}
                  onChange={(event) => onUpdate("access_level", event.target.value as AssetAccessLevel)}
                >
                  <option value="free">免费</option>
                  <option value="vip">VIP</option>
                </select>
              </Field>
              <Field label="状态">
                <select
                  className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm"
                  value={form.status}
                  onChange={(event) => onUpdate("status", event.target.value as ArtStyleFormState["status"])}
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </Field>
              <Field label="排序">
                <Input inputMode="numeric" value={form.sort_order} onChange={(event) => onUpdate("sort_order", event.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving || isUploading} type="submit">
            <Save className="h-4 w-4" />
            {isUploading ? "上传图片中..." : isSaving ? "保存中..." : "保存画风"}
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
