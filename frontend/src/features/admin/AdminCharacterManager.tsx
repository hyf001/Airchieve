import React from "react";
import { Edit3, ImagePlus, Plus, Save, Sparkles, Trash2, Wand2, X } from "lucide-react";

import { useRouter } from "@/app/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArtStyle, AssetAccessLevel, CharacterSummary, LibraryItemStatus } from "@/entities/asset";
import { TaxonomySelect } from "@/entities/taxonomy";
import { artStyleLibraryApi } from "@/features/art-style-library";
import { storeCharacterCreationReference } from "@/features/character-library";
import { cn } from "@/lib/utils";
import { useToast } from "@/shared/ui/toast";

import { adminApi } from "./api";
import type { SystemCharacterWrite } from "./types";

interface CharacterFormState {
  name: string;
  description: string;
  image_asset_id: number | null;
  image_url: string;
  art_style_id: string;
  generation_prompt: string;
  category_code: string;
  access_level: AssetAccessLevel;
  status: Exclude<LibraryItemStatus, "deleted">;
}

const emptyForm: CharacterFormState = {
  name: "",
  description: "",
  image_asset_id: null,
  image_url: "",
  art_style_id: "",
  generation_prompt: "",
  category_code: "",
  access_level: "free",
  status: "active",
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

const toForm = (character: CharacterSummary): CharacterFormState => ({
  name: character.name,
  description: character.description ?? "",
  image_asset_id: character.image_asset_id,
  image_url: character.image_url ?? "",
  art_style_id: character.art_style_id ? String(character.art_style_id) : "",
  generation_prompt: "",
  category_code: character.category_code ?? "",
  access_level: character.access_level,
  status: character.status === "disabled" ? "disabled" : "active",
});

const toPayload = (form: CharacterFormState, options?: { omitGenerationFields?: boolean }): SystemCharacterWrite => ({
  name: form.name.trim(),
  identity_tag: null,
  description: form.description.trim() || null,
  image_asset_id: form.image_asset_id,
  image_url: form.image_url || null,
  art_style_id: options?.omitGenerationFields ? null : form.art_style_id ? Number(form.art_style_id) : null,
  generation_prompt: options?.omitGenerationFields ? null : form.generation_prompt.trim() || null,
  category_code: form.category_code.trim() || null,
  access_level: form.access_level,
  status: form.status,
});

export const AdminCharacterManager: React.FC = () => {
  const { navigate } = useRouter();
  const [items, setItems] = React.useState<CharacterSummary[]>([]);
  const [artStyles, setArtStyles] = React.useState<ArtStyle[]>([]);
  const [form, setForm] = React.useState<CharacterFormState>(emptyForm);
  const [pendingImageFile, setPendingImageFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState("");
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const { showToast } = useToast();

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [charactersResponse, artStyleResponse] = await Promise.all([adminApi.listCharacters(), artStyleLibraryApi.list()]);
      setItems(charactersResponse.items);
      setArtStyles(artStyleResponse.items.filter((style) => style.owner_user_id === null));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "系统角色加载失败", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateForm = <K extends keyof CharacterFormState>(key: K, value: CharacterFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPendingImageFile(null);
    setPreviewUrl("");
    setDialogOpen(true);
  };

  const openEdit = (character: CharacterSummary) => {
    setEditingId(character.id);
    setForm(toForm(character));
    setPendingImageFile(null);
    setPreviewUrl(character.image_url ?? "");
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
    const isCreate = editingId === null;
    const payload = toPayload(form, { omitGenerationFields: isCreate });
    const hasImage = Boolean(payload.image_asset_id || payload.image_url || pendingImageFile);
    if (!payload.name || !hasImage) {
      showToast("请填写名称和图片", "error");
      return;
    }
    setIsSaving(true);
    try {
      if (pendingImageFile) {
        setIsUploading(true);
        const dataUrl = await readFileAsDataUrl(pendingImageFile);
        const image = await adminApi.uploadCharacterImage({
          base64: dataUrl,
          mime_type: pendingImageFile.type || "image/png",
          filename: pendingImageFile.name,
        });
        payload.image_asset_id = image.id;
        payload.image_url = image.url;
        setIsUploading(false);
      }
      if (editingId) {
        await adminApi.updateCharacter(editingId, payload);
        showToast("系统角色已更新", "success");
      } else {
        await adminApi.createCharacter(payload);
        showToast("系统角色已创建", "success");
      }
      closeDialog();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "系统角色保存失败", "error");
    } finally {
      setIsUploading(false);
      setIsSaving(false);
    }
  };

  const handleDelete = async (character: CharacterSummary) => {
    if (!window.confirm(`确认删除「${character.name}」吗？`)) return;
    try {
      await adminApi.deleteCharacter(character.id);
      showToast("系统角色已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "系统角色删除失败", "error");
    }
  };

  const handleCreateFromReference = (character: CharacterSummary) => {
    storeCharacterCreationReference(character);
    navigate("/characters");
  };

  return (
    <>
      <section className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">系统角色</h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">管理前台系统角色卡片、分类、权益和绑定画风。</p>
          </div>
          <Button size="sm" type="button" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增角色
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            正在加载系统角色...
          </div>
        ) : items.length ? (
          <div className="mt-5 grid grid-cols-4 gap-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {items.map((character) => (
              <CharacterAdminCard
                key={character.id}
                artStyles={artStyles}
                character={character}
                onCreateFromReference={() => handleCreateFromReference(character)}
                onDelete={() => void handleDelete(character)}
                onEdit={() => openEdit(character)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            暂无系统角色，点击右上角新增。
          </div>
        )}
      </section>

      <EditDialog
        artStyles={artStyles}
        form={form}
        isOpen={dialogOpen}
        isSaving={isSaving}
        isUploading={isUploading}
        mode={editingId ? "edit" : "create"}
        previewUrl={previewUrl || form.image_url}
        title={editingId ? "编辑系统角色" : "新增系统角色"}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onUpdate={updateForm}
        onSelectImage={handleSelectImage}
      />
    </>
  );
};

const CharacterAdminCard: React.FC<{
  artStyles: ArtStyle[];
  character: CharacterSummary;
  onCreateFromReference: () => void;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ artStyles, character, onCreateFromReference, onDelete, onEdit }) => {
  const artStyle = artStyles.find((style) => style.id === character.art_style_id);

  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(255,248,240,0.72)] shadow-[var(--shadow-soft)]">
      <div className="relative aspect-[4/3] bg-[linear-gradient(135deg,rgba(245,166,35,0.16),rgba(139,198,168,0.18))]">
        {character.image_url ? (
          <img alt="" className="h-full w-full object-cover" src={character.image_url} />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--terracotta)]">
            <Sparkles className="h-9 w-9" />
          </div>
        )}
        <div className="absolute right-3 top-3 flex gap-2">
          <Button aria-label={`编辑${character.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button aria-label={`删除${character.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl">{character.name}</h3>
            <p className="mt-1 truncate text-xs font-bold text-[var(--text-light)]">{artStyle?.name ?? "系统角色"}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
              character.access_level === "vip"
                ? "bg-[rgba(255,138,101,0.14)] text-[var(--peach)]"
                : "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]",
            )}
          >
            {character.access_level === "vip" ? "VIP" : "免费"}
          </span>
        </div>
        <p className="mt-3 line-clamp-2 min-h-[44px] text-sm leading-6 text-[var(--text-mid)]">{character.description ?? "未填写角色描述"}</p>
        <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--text-light)]">
          <span>{character.status === "active" ? "启用" : "停用"}</span>
          <span>{artStyle?.name ?? character.art_style_code ?? "未绑定画风"}</span>
        </div>
        <div className="mt-4">
          <Button className="w-full" size="sm" type="button" variant="outline" onClick={onCreateFromReference}>
            <Wand2 className="h-3.5 w-3.5" />
            基于此角色创建
          </Button>
        </div>
      </div>
    </article>
  );
};

const EditDialog: React.FC<{
  artStyles: ArtStyle[];
  form: CharacterFormState;
  isOpen: boolean;
  isSaving: boolean;
  isUploading: boolean;
  mode: "create" | "edit";
  previewUrl: string;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof CharacterFormState>(key: K, value: CharacterFormState[K]) => void;
  onSelectImage: (file: File) => void;
}> = ({ artStyles, form, isOpen, isSaving, isUploading, mode, previewUrl, title, onClose, onSubmit, onUpdate, onSelectImage }) => {
  const inputId = React.useId();
  const isCreate = mode === "create";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[560px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="character-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">
              {isCreate ? "配置系统角色图片、分类和权益状态。" : "配置系统角色图片、分类、绑定画风和权益状态。"}
            </p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <Field label="角色图片">
              <label
                className="group relative flex min-h-[210px] cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(212,114,92,0.22)] bg-[var(--cream)] text-center transition hover:border-[var(--peach)]"
                htmlFor={inputId}
              >
                {previewUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover" src={previewUrl} /> : null}
                <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[var(--terracotta)] shadow-[var(--shadow-soft)]">
                  <ImagePlus className="h-4 w-4" />
                  {previewUrl ? "更换图片" : "选择图片"}
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
            </Field>

            <Field label="名称">
              <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="森林小伙伴" />
            </Field>

            <Field label="描述">
              <textarea
                className="min-h-[96px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                placeholder="前台展示的系统角色说明"
              />
            </Field>

            {isCreate ? null : (
              <Field label="角色提示词">
                <textarea
                  className="min-h-[108px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                  value={form.generation_prompt}
                  onChange={(event) => onUpdate("generation_prompt", event.target.value)}
                  placeholder="记录生成或运营配置时使用的角色描述"
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              {isCreate ? null : (
                <Field label="绑定画风">
                  <select
                    className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm"
                    value={form.art_style_id}
                    onChange={(event) => onUpdate("art_style_id", event.target.value)}
                  >
                    <option value="">请选择画风</option>
                    {artStyles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="角色分类">
                <TaxonomySelect
                  type="character_category"
                  value={form.category_code || null}
                  onChange={(code) => onUpdate("category_code", code ?? "")}
                  placeholder="请选择角色分类"
                  className="h-[46px] border-2 border-[rgba(212,114,92,0.14)] focus:border-[var(--peach)] focus:ring-[rgba(255,138,101,0.12)]"
                />
              </Field>
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
                  onChange={(event) => onUpdate("status", event.target.value as CharacterFormState["status"])}
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving || isUploading} type="submit">
            <Save className="h-4 w-4" />
            {isUploading ? "上传图片中..." : isSaving ? "保存中..." : "保存系统角色"}
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
