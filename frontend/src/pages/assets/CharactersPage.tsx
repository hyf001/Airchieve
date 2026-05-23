import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Pencil, Plus, ShieldCheck, Sparkles, Trash2, UserRound, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArtStyle, CharacterSummary } from "@/entities/asset";
import { AssetAccessBadge } from "@/entities/asset";
import { TaxonomySelect } from "@/entities/taxonomy";
import { artStyleLibraryApi } from "@/features/art-style-library";
import {
  CharacterCreateForm,
  characterLibraryApi,
  clearCharacterCreationReference,
  readCharacterCreationReference,
  type CharacterCreationReference,
  type CharacterCreatePayload,
} from "@/features/character-library";
import { privacyApi, UploadConsentDialog } from "@/features/privacy";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

type CharacterTab = "system" | "custom";

interface UploadCharacterFormState {
  name: string;
  description: string;
  category_code: string;
}

interface EditCharacterFormState {
  name: string;
  description: string;
  image_url: string;
  art_style_id: string;
  generation_prompt: string;
  category_code: string;
}

const emptyUploadForm: UploadCharacterFormState = {
  name: "",
  description: "",
  category_code: "",
};

const emptyEditForm: EditCharacterFormState = {
  name: "",
  description: "",
  image_url: "",
  art_style_id: "",
  generation_prompt: "",
  category_code: "",
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });

export const CharactersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CharacterTab>("custom");
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreviewUrl, setReferencePreviewUrl] = useState("");
  const [uploadForm, setUploadForm] = useState<UploadCharacterFormState>(emptyUploadForm);
  const [editForm, setEditForm] = useState<EditCharacterFormState>(emptyEditForm);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editPreviewUrl, setEditPreviewUrl] = useState("");
  const [editingCharacter, setEditingCharacter] = useState<CharacterSummary | null>(null);
  const [referenceCharacter, setReferenceCharacter] = useState<CharacterCreationReference | null>(() => readCharacterCreationReference());
  const [consentChecked, setConsentChecked] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(() => readCharacterCreationReference() !== null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const systemCharacters = useMemo(() => characters.filter((item) => item.owner_user_id === null), [characters]);
  const customCharacters = useMemo(() => characters.filter((item) => item.owner_user_id !== null), [characters]);
  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [charactersResponse, artStylesResponse] = await Promise.all([characterLibraryApi.list(), artStyleLibraryApi.list()]);
      setCharacters(charactersResponse.items);
      setArtStyles(artStylesResponse.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "角色库加载失败", "error");
      setCharacters([]);
      setArtStyles([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const hasActiveGeneration = characters.some((character) => character.generation_status === "queued" || character.generation_status === "running");
    if (!hasActiveGeneration) return;
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [characters, load]);

  useEffect(() => {
    if (!referenceCharacter) return;
    clearCharacterCreationReference();
    setAiDrawerOpen(true);
  }, [referenceCharacter]);

  const handleSelect = (character: CharacterSummary) => {
    setSelectedId((current) => (current === character.id ? null : character.id));
    showToast(`已选择「${character.name}」角色`, "success");
  };

  const openUploadCreate = () => {
    setReferenceFile(null);
    setReferencePreviewUrl("");
    setUploadForm(emptyUploadForm);
    setConsentChecked(false);
    setUploadDrawerOpen(true);
  };

  const closeUploadCreate = () => {
    if (isSubmitting) return;
    setReferenceFile(null);
    setReferencePreviewUrl("");
    setUploadForm(emptyUploadForm);
    setConsentChecked(false);
    setUploadDrawerOpen(false);
  };

  const openAiCreate = (character: CharacterSummary) => {
    setReferenceCharacter({ id: character.id, name: character.name });
    setAiDrawerOpen(true);
  };

  const closeAiCreate = () => {
    if (isSubmitting) return;
    setAiDrawerOpen(false);
    setReferenceCharacter(null);
    clearCharacterCreationReference();
  };

  const updateUploadForm = <K extends keyof UploadCharacterFormState>(key: K, value: UploadCharacterFormState[K]) => {
    setUploadForm((current) => ({ ...current, [key]: value }));
  };

  const updateEditForm = <K extends keyof EditCharacterFormState>(key: K, value: EditCharacterFormState[K]) => {
    setEditForm((current) => ({ ...current, [key]: value }));
  };

  const handleSelectReferenceFile = (file: File) => {
    setReferenceFile(file);
    setReferencePreviewUrl(URL.createObjectURL(file));
  };

  const handleSelectEditImage = (file: File) => {
    setEditImageFile(file);
    setEditPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: CharacterCreatePayload = {
      name: uploadForm.name.trim(),
      description: uploadForm.description.trim() || null,
      art_style_id: null,
      category_code: uploadForm.category_code.trim() || null,
      generation_prompt: null,
    };
    if (!payload.name) {
      showToast("请填写名称", "error");
      return;
    }

    let referenceAssetId: number | null = null;
    let uploadConsentId: number | null = null;
    if (referenceFile) {
      if (!consentChecked) {
        showToast("上传参考图前需要先确认素材授权", "error");
        return;
      }
      const consent = await privacyApi.recordUploadConsent({
        target_type: "character_reference_image",
        target_id: null,
        confirmed_rights: true,
        confirmed_privacy: true,
      });
      const asset = await characterLibraryApi.uploadCharacterImage({
        base64: await readFileAsDataUrl(referenceFile),
        mime_type: referenceFile.type || "image/jpeg",
        filename: referenceFile.name,
      });
      referenceAssetId = asset.id;
      uploadConsentId = consent.id;
    }

    setIsSubmitting(true);
    try {
      await characterLibraryApi.create({
        ...payload,
        reference_character_id: null,
        reference_asset_id: referenceAssetId,
        upload_consent_id: uploadConsentId,
      });
      closeUploadCreate();
      setActiveTab("custom");
      await load();
      showToast(referenceAssetId ? "自定义角色已创建" : "自定义角色已创建，生成任务正在排队", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义角色创建失败", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAiCreate = async (payload: CharacterCreatePayload) => {
    if (!referenceCharacter) {
      showToast("请先选择参考角色", "error");
      return false;
    }

    setIsSubmitting(true);
    try {
      await characterLibraryApi.create({
        ...payload,
        reference_character_id: referenceCharacter.id,
        reference_asset_id: null,
        upload_consent_id: null,
      });
      closeAiCreate();
      setActiveTab("custom");
      await load();
      showToast("已基于参考角色创建新角色，生成任务正在排队", "success");
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "AI 角色创建失败", "error");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustom = async (character: CharacterSummary) => {
    if (character.owner_user_id === null) return;
    if (!window.confirm(`确认删除「${character.name}」吗？`)) return;
    try {
      await characterLibraryApi.remove(character.id);
      if (selectedId === character.id) setSelectedId(null);
      showToast("自定义角色已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义角色删除失败", "error");
    }
  };

  const openEdit = async (character: CharacterSummary) => {
    setEditingCharacter(character);
    setEditForm({
      name: character.name,
      description: character.description ?? "",
      image_url: character.image_url ?? "",
      art_style_id: character.art_style_id ? String(character.art_style_id) : "",
      generation_prompt: "",
      category_code: character.category_code ?? "",
    });
    setEditImageFile(null);
    setEditPreviewUrl(character.image_url ?? "");
    setEditDrawerOpen(true);
    try {
      const detail = await characterLibraryApi.get(character.id);
      setEditForm({
        name: detail.name,
        description: detail.description ?? "",
        image_url: detail.image_url ?? "",
        art_style_id: detail.art_style_id ? String(detail.art_style_id) : "",
        generation_prompt: detail.generation_prompt ?? "",
        category_code: detail.category_code ?? "",
      });
      setEditPreviewUrl(detail.image_url ?? "");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "角色详情加载失败", "error");
    }
  };

  const closeEdit = () => {
    if (isSubmitting) return;
    setEditDrawerOpen(false);
    setEditingCharacter(null);
    setEditForm(emptyEditForm);
    setEditImageFile(null);
    setEditPreviewUrl("");
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCharacter) return;
    if (!editForm.name.trim()) {
      showToast("请填写名称", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = editForm.image_url.trim() || null;
      if (editImageFile) {
        const image = await characterLibraryApi.uploadCharacterImage({
          base64: await readFileAsDataUrl(editImageFile),
          mime_type: editImageFile.type || "image/png",
          filename: editImageFile.name,
        });
        imageUrl = image.url;
      }
      await characterLibraryApi.update(editingCharacter.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        image_url: imageUrl,
        art_style_id: editForm.art_style_id ? Number(editForm.art_style_id) : null,
        generation_prompt: editForm.generation_prompt.trim() || null,
        category_code: editForm.category_code.trim() || null,
      });
      closeEdit();
      await load();
      showToast("角色已更新", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "角色更新失败", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (character: CharacterSummary) => {
    await characterLibraryApi.setDefault(character.id);
    showToast(`已将「${character.name}」设为默认角色`, "success");
    await load();
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-8 pb-12 max-sm:px-4">
        <header className="relative py-12 text-center max-sm:py-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(139,198,168,0.08),transparent_70%)]" />
          <h1 className="font-display relative text-[38px] leading-tight text-[var(--text-dark)] max-sm:text-[30px]">角色</h1>
          <p className="relative mx-auto mt-2 max-w-[560px] text-base leading-7 text-[var(--text-mid)]">
            管理绘本里的主角角色。你可以上传参考图创建自定义角色，也可以基于已有角色生成新角色。
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")}>
              系统角色
              <span className="rounded-full bg-[rgba(245,166,35,0.14)] px-2 py-0.5 text-xs text-[var(--honey)]">{systemCharacters.length}</span>
            </TabButton>
            <TabButton active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
              自定义角色
              <span className="rounded-full bg-[rgba(139,198,168,0.16)] px-2 py-0.5 text-xs text-[var(--sage-deep)]">{customCharacters.length}</span>
            </TabButton>
          </div>
        </div>

        {activeTab === "system" ? (
          <section>
            <SectionTitle title="系统角色" badge={`${systemCharacters.length} 个可用`} />
            {isLoading ? (
              <EmptyState text="正在加载系统角色..." />
            ) : systemCharacters.length ? (
              <CharacterCardGrid
                artStyles={artStyles}
                characters={systemCharacters}
                selectedId={selectedId}
                onCreateFromReference={openAiCreate}
                onSelect={handleSelect}
              />
            ) : (
              <EmptyState text="系统角色库暂无数据，管理员配置后会展示在这里。" />
            )}
          </section>
        ) : null}

        {activeTab === "custom" ? (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="自定义角色" />
              <Button size="sm" type="button" variant="outline" onClick={openUploadCreate}>
                <Plus className="h-4 w-4" />
                新增角色
              </Button>
            </div>
            {isLoading ? (
              <EmptyState text="正在加载自定义角色..." />
            ) : customCharacters.length ? (
              <CharacterCardGrid
                artStyles={artStyles}
                characters={customCharacters}
                selectedId={selectedId}
                onCreateFromReference={openAiCreate}
                onDelete={handleDeleteCustom}
                onEdit={openEdit}
                onSelect={handleSelect}
                onSetDefault={handleSetDefault}
              />
            ) : (
              <EmptyState text="还没有自定义角色，点击右上角新增。" />
            )}
          </section>
        ) : null}
      </main>

      <UploadCreateDrawer
        consentChecked={consentChecked}
        form={uploadForm}
        isOpen={uploadDrawerOpen}
        isSubmitting={isSubmitting}
        previewUrl={referencePreviewUrl}
        referenceFile={referenceFile}
        onClose={closeUploadCreate}
        onConsentCheckedChange={setConsentChecked}
        onSelectReferenceFile={handleSelectReferenceFile}
        onSubmit={handleUploadCreate}
        onUpdate={updateUploadForm}
      />
      <AiCreateDrawer
        artStyles={artStyles}
        isOpen={aiDrawerOpen}
        isSubmitting={isSubmitting}
        referenceCharacter={referenceCharacter}
        onClose={closeAiCreate}
        onSubmit={handleAiCreate}
      />
      <EditCharacterDrawer
        artStyles={artStyles}
        character={editingCharacter}
        form={editForm}
        isOpen={editDrawerOpen}
        isSubmitting={isSubmitting}
        previewUrl={editPreviewUrl || editForm.image_url}
        onClose={closeEdit}
        onSelectImage={handleSelectEditImage}
        onSubmit={handleEditSubmit}
        onUpdate={updateEditForm}
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

const EmptyState: React.FC<{ text: string }> = ({ text }) => <div className="app-card p-7 text-sm text-[var(--text-light)]">{text}</div>;

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
    {label}
    {children}
  </label>
);

const UploadCreateDrawer: React.FC<{
  consentChecked: boolean;
  form: UploadCharacterFormState;
  isOpen: boolean;
  isSubmitting: boolean;
  previewUrl: string;
  referenceFile: File | null;
  onClose: () => void;
  onConsentCheckedChange: (checked: boolean) => void;
  onSelectReferenceFile: (file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof UploadCharacterFormState>(key: K, value: UploadCharacterFormState[K]) => void;
}> = ({ consentChecked, form, isOpen, isSubmitting, previewUrl, referenceFile, onClose, onConsentCheckedChange, onSelectReferenceFile, onSubmit, onUpdate }) => {
  const inputId = React.useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[620px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-character-drawer-title"
        onSubmit={onSubmit}
      >
        <DrawerHeader
          desc="上传头像或参考图，再配置角色图片和分类。"
          titleId="upload-character-drawer-title"
          title="新增自定义角色"
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <Field label="角色图片">
              <label
                className="group relative flex min-h-[210px] cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(212,114,92,0.22)] bg-[var(--cream)] text-center transition hover:border-[var(--peach)]"
                htmlFor={inputId}
              >
                {previewUrl ? <img alt="" className="absolute inset-0 h-full w-full object-cover" src={previewUrl} /> : null}
                <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[var(--terracotta)] shadow-[var(--shadow-soft)]">
                  <Plus className="h-4 w-4" />
                  {previewUrl ? referenceFile?.name ?? "更换图片" : "选择图片"}
                </span>
                <input
                  id={inputId}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  disabled={isSubmitting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectReferenceFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </Field>

            <UploadConsentDialog checked={consentChecked} onCheckedChange={onConsentCheckedChange} />
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[rgba(139,198,168,0.12)] bg-[rgba(139,198,168,0.08)] p-4">
              <ShieldCheck className="mt-1 h-5 w-5 text-[var(--sage-deep)]" />
              <p className="text-sm text-[var(--text-mid)]">上传图片会作为这个自定义角色的展示图，并默认保持私有。</p>
            </div>

            <Field label="名称">
              <Input disabled={isSubmitting} value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="森林小伙伴" />
            </Field>

            <Field label="描述">
              <textarea
                className="min-h-[96px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                disabled={isSubmitting}
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                placeholder="前台展示的自定义角色说明"
              />
            </Field>

            <Field label="角色分类">
              <TaxonomySelect
                type="character_category"
                value={form.category_code || null}
                onChange={(code) => onUpdate("category_code", code ?? "")}
                placeholder="请选择角色分类"
                className="h-[46px] border-2 border-[rgba(212,114,92,0.14)] focus:border-[var(--peach)] focus:ring-[rgba(255,138,101,0.12)]"
              />
            </Field>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "创建中..." : "创建角色"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const AiCreateDrawer: React.FC<{
  artStyles: ArtStyle[];
  isOpen: boolean;
  isSubmitting: boolean;
  referenceCharacter: CharacterCreationReference | null;
  onClose: () => void;
  onSubmit: (payload: CharacterCreatePayload) => Promise<boolean | void>;
}> = ({ artStyles, isOpen, isSubmitting, referenceCharacter, onClose, onSubmit }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <aside
        className="flex h-full w-full max-w-[560px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-character-drawer-title"
      >
        <DrawerHeader
          desc="以已有角色为参考，填写新角色的生成参数。"
          titleId="ai-character-drawer-title"
          title="基于此角色创建"
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            {referenceCharacter ? (
              <div className="rounded-[var(--radius-md)] bg-[rgba(139,198,168,0.12)] p-4">
                <p className="text-sm font-bold text-[var(--sage-deep)]">参考角色：{referenceCharacter.name}</p>
                <p className="mt-1 text-sm text-[var(--text-light)]">提交后会使用该角色作为参考，生成一个新的自定义角色。</p>
              </div>
            ) : null}
            <CharacterCreateForm
              artStyles={artStyles}
              className="border-0 bg-transparent p-0 shadow-none"
              disabled={isSubmitting}
              referenceCharacter={referenceCharacter}
              onSubmit={onSubmit}
            />
          </div>
        </div>
      </aside>
    </div>
  );
};

const EditCharacterDrawer: React.FC<{
  artStyles: ArtStyle[];
  character: CharacterSummary | null;
  form: EditCharacterFormState;
  isOpen: boolean;
  isSubmitting: boolean;
  previewUrl: string;
  onClose: () => void;
  onSelectImage: (file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof EditCharacterFormState>(key: K, value: EditCharacterFormState[K]) => void;
}> = ({ artStyles, character, form, isOpen, isSubmitting, previewUrl, onClose, onSelectImage, onSubmit, onUpdate }) => {
  const inputId = React.useId();

  if (!isOpen || !character) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[560px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-character-drawer-title"
        onSubmit={onSubmit}
      >
        <DrawerHeader
          desc={character.source_type === "ai_generated" ? "可调整角色展示信息和系统提示词。" : "可调整角色展示信息，手动上传角色的系统提示词可以留空。"}
          titleId="edit-character-drawer-title"
          title="编辑角色"
          onClose={onClose}
        />
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
                  disabled={isSubmitting}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectImage(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </Field>
            <Field label="名称">
              <Input disabled={isSubmitting} value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="角色名称" />
            </Field>
            <Field label="描述">
              <textarea
                className="min-h-[96px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                disabled={isSubmitting}
                value={form.description}
                onChange={(event) => onUpdate("description", event.target.value)}
                placeholder="前台展示的自定义角色说明"
              />
            </Field>
            <Field label="系统提示词">
              <textarea
                className="min-h-[132px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                disabled={isSubmitting}
                value={form.generation_prompt}
                onChange={(event) => onUpdate("generation_prompt", event.target.value)}
                placeholder="手动上传角色可以留空"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              <Field label="绑定画风">
                <select
                  className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm"
                  disabled={isSubmitting}
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
              <Field label="角色分类">
                <TaxonomySelect
                  type="character_category"
                  value={form.category_code || null}
                  onChange={(code) => onUpdate("category_code", code ?? "")}
                  placeholder="请选择角色分类"
                  className="h-[46px] border-2 border-[rgba(212,114,92,0.14)] focus:border-[var(--peach)] focus:ring-[rgba(255,138,101,0.12)]"
                />
              </Field>
            </div>
          </div>
        </div>
        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "保存中..." : "保存修改"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const DrawerHeader: React.FC<{ desc: string; title: string; titleId: string; onClose: () => void }> = ({ desc, title, titleId, onClose }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
    <div>
      <h2 id={titleId} className="font-display text-2xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-light)]">{desc}</p>
    </div>
    <Button aria-label="关闭创建框" size="icon" type="button" variant="ghost" onClick={onClose}>
      <X className="h-4 w-4" />
    </Button>
  </div>
);

const CharacterCardGrid: React.FC<{
  artStyles: ArtStyle[];
  characters: CharacterSummary[];
  selectedId: number | null;
  onCreateFromReference: (character: CharacterSummary) => void;
  onDelete?: (character: CharacterSummary) => void;
  onEdit?: (character: CharacterSummary) => void;
  onSelect: (character: CharacterSummary) => void;
  onSetDefault?: (character: CharacterSummary) => void;
}> = ({ artStyles, characters, selectedId, onCreateFromReference, onDelete, onEdit, onSelect, onSetDefault }) => (
  <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
    {characters.map((character) => {
      const artStyle = artStyles.find((style) => style.id === character.art_style_id);
      const isCustom = character.owner_user_id !== null;
      return (
        <CharacterCard
          key={character.id}
          artStyle={artStyle}
          character={character}
          isCustom={isCustom}
          selected={selectedId === character.id}
          onCreateFromReference={() => onCreateFromReference(character)}
          onDelete={onDelete ? () => onDelete(character) : undefined}
          onEdit={onEdit && isCustom ? () => onEdit(character) : undefined}
          onSelect={() => onSelect(character)}
          onSetDefault={onSetDefault && isCustom ? () => onSetDefault(character) : undefined}
        />
      );
    })}
  </div>
);

const CharacterCard: React.FC<{
  artStyle?: ArtStyle;
  character: CharacterSummary;
  isCustom: boolean;
  selected: boolean;
  onCreateFromReference: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onSelect: () => void;
  onSetDefault?: () => void;
}> = ({ artStyle, character, isCustom, selected, onCreateFromReference, onDelete, onEdit, onSelect, onSetDefault }) => {
  const isGenerating = !character.image_url && (character.generation_status === "queued" || character.generation_status === "running");
  const isGenerationFailed = !character.image_url && character.generation_status === "failed";
  const progress = character.generation_progress_percent ?? (character.generation_status === "queued" ? 0 : 10);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[20px] border-[2.5px] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
        selected ? "border-[var(--honey)] shadow-[0_0_0_3px_rgba(245,166,35,0.15),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
      )}
    >
      <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
        {onEdit ? (
          <Button aria-label={`编辑${character.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button aria-label={`删除${character.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <button className="block w-full text-left" type="button" onClick={onSelect}>
        <div className="relative h-[220px] overflow-hidden bg-[linear-gradient(135deg,rgba(245,166,35,0.16),rgba(139,198,168,0.18))]">
          {character.image_url ? (
            <img alt={character.name} className="h-full w-full object-cover" src={character.image_url} />
          ) : isGenerating ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/80 shadow-[var(--shadow-soft)]">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--terracotta)]" />
              </div>
              <p className="mt-4 text-sm font-bold text-[var(--text-dark)]">角色生成中</p>
              <p className="mt-1 text-xs text-[var(--text-light)]">{character.generation_status === "queued" ? "正在排队，请稍候" : "正在绘制角色图片"}</p>
              <div className="mt-4 h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-white/80">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--terracotta),var(--honey))]" style={{ width: `${Math.min(100, Math.max(8, progress))}%` }} />
              </div>
            </div>
          ) : isGenerationFailed ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-[var(--terracotta)] shadow-[var(--shadow-soft)]">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="mt-4 text-sm font-bold text-[var(--text-dark)]">生成失败</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-light)]">{character.generation_error_message ?? "角色图片生成失败，请稍后重试。"}</p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--terracotta)]">
              {isCustom ? <UserRound className="h-10 w-10" /> : <Sparkles className="h-10 w-10" />}
            </div>
          )}
          <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-2">
            {character.is_default ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--honey)]">默认</span> : null}
            {character.source_type === "ai_generated" ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">AI生成</span> : null}
            {isGenerating ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--sage-deep)]">生成中</span> : null}
            {isGenerationFailed ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">失败</span> : null}
            <AssetAccessBadge accessLevel={character.access_level} />
          </div>
        </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl text-[var(--text-dark)]">{character.name}</h3>
            <p className="mt-1 truncate text-xs font-bold text-[var(--text-light)]">
              {character.identity_tag ?? artStyle?.name ?? character.custom_art_style_prompt ?? "角色"}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[rgba(126,200,227,0.14)] px-2.5 py-1 text-xs font-bold text-[var(--sky-deep)]">
            {isCustom ? "自定义" : "系统"}
          </span>
        </div>
        <p className="mt-3 min-h-[68px] text-[13px] leading-6 text-[var(--text-mid)]">
          {character.description ?? character.custom_art_style_prompt ?? artStyle?.description ?? "暂无角色描述"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 text-xs font-semibold text-[var(--text-mid)]">
            {artStyle?.name ?? character.art_style_code ?? "自定义画风"}
          </span>
          {(artStyle?.age_range_codes ?? []).slice(0, 2).map((code) => (
            <span key={code} className="rounded-full bg-[rgba(139,198,168,0.14)] px-2.5 py-1 text-xs font-semibold text-[var(--sage-deep)]">
              {code}
            </span>
          ))}
        </div>
      </div>
    </button>
    <div className="flex flex-wrap gap-2 px-5 pb-5">
      <Button size="sm" type="button" variant={selected ? "default" : "outline"} onClick={onSelect}>
        {selected ? "已选择" : "选择"}
      </Button>
      <Button size="sm" type="button" variant="outline" onClick={onCreateFromReference}>
        <Wand2 className="h-3.5 w-3.5" />
        基于此角色创建
      </Button>
      {onSetDefault ? (
        <Button size="sm" type="button" variant="ghost" onClick={onSetDefault}>
          设为默认
        </Button>
      ) : null}
    </div>
  </article>
  );
};
