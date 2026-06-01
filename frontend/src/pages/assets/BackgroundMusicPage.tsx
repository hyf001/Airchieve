import React, { useEffect, useMemo, useState } from "react";
import { Check, Edit3, Headphones, Music2, Plus, Save, Star, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BackgroundMusicSummary } from "@/entities/asset";
import { backgroundMusicLibraryApi, type BackgroundMusicCreatePayload, type BackgroundMusicUpdatePayload } from "@/features/background-music-library";
import { useAuth } from "@/features/auth";
import { privacyApi } from "@/features/privacy";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

interface MusicFormState {
  name: string;
  description: string;
  audio_url: string;
  duration_seconds: string;
}

const emptyMusicForm: MusicFormState = {
  name: "",
  description: "",
  audio_url: "",
  duration_seconds: "",
};

const toForm = (music: BackgroundMusicSummary): MusicFormState => ({
  name: music.name,
  description: music.description ?? "",
  audio_url: music.audio_url,
  duration_seconds: music.duration_seconds ? String(music.duration_seconds) : "",
});

const toPayload = (form: MusicFormState): BackgroundMusicCreatePayload => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  audio_asset_id: 0,
  upload_consent_id: null,
  duration_seconds: form.duration_seconds ? Number(form.duration_seconds) || null : null,
});

export const BackgroundMusicPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"system" | "custom">("system");
  const [items, setItems] = useState<BackgroundMusicSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [musicForm, setMusicForm] = useState<MusicFormState>(emptyMusicForm);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const systemItems = useMemo(() => items.filter((music) => music.owner_user_id === null), [items]);
  const customItems = useMemo(() => items.filter((music) => music.owner_user_id !== null), [items]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await backgroundMusicLibraryApi.list();
      setItems(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "背景音乐库加载失败", "error");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (music: BackgroundMusicSummary) => {
    setSelectedId((current) => (current === music.id ? null : music.id));
    showToast(`已选择「${music.name}」背景音乐`, "success");
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      showToast("登录后可以新增自定义背景音乐", "error");
      return;
    }
    setEditingId(null);
    setMusicForm(emptyMusicForm);
    setPendingAudioFile(null);
    setDialogOpen(true);
  };

  const openEdit = (music: BackgroundMusicSummary) => {
    if (music.owner_user_id === null) return;
    setEditingId(music.id);
    setMusicForm(toForm(music));
    setPendingAudioFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setDialogOpen(false);
    setEditingId(null);
    setMusicForm(emptyMusicForm);
    setPendingAudioFile(null);
  };

  const updateMusicForm = <K extends keyof MusicFormState>(key: K, value: MusicFormState[K]) => {
    setMusicForm((current) => ({ ...current, [key]: value }));
  };

  const uploadPendingAudio = async () => {
    if (!pendingAudioFile) return null;
    const consent = await privacyApi.recordUploadConsent({
      target_type: "upload_file",
      target_id: null,
      confirmed_rights: true,
      confirmed_privacy: true,
    });
    const session = await backgroundMusicLibraryApi.createUploadSession({
      purpose: "background_music",
      filename: pendingAudioFile.name,
      mime_type: pendingAudioFile.type || "audio/mpeg",
      byte_size: pendingAudioFile.size,
    });
    await backgroundMusicLibraryApi.uploadToStorage(session, pendingAudioFile);
    const asset = await backgroundMusicLibraryApi.completeUpload(session.id, {
      byte_size: pendingAudioFile.size,
      asset_kind: "audio",
      visibility: "private",
    });
    return { assetId: asset.id, consentId: consent.id, url: asset.url };
  };

  const handleSubmitMusic = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(musicForm);
    if (!payload.name) {
      showToast("请填写背景音乐名称", "error");
      return;
    }
    if (!isAuthenticated) {
      showToast("登录后可以新增自定义背景音乐", "error");
      return;
    }

    setIsSaving(true);
    try {
      const audio = await uploadPendingAudio();
      if (!editingId && !audio) throw new Error("请上传背景音乐音频");
      const writePayload: BackgroundMusicUpdatePayload = {
        name: payload.name,
        description: payload.description,
        duration_seconds: payload.duration_seconds,
      };
      if (audio) {
        writePayload.audio_asset_id = audio.assetId;
        writePayload.upload_consent_id = audio.consentId;
      }
      const music = editingId
        ? await backgroundMusicLibraryApi.update(editingId, writePayload)
        : await backgroundMusicLibraryApi.create({
            ...payload,
            audio_asset_id: audio?.assetId ?? 0,
            upload_consent_id: audio?.consentId ?? null,
          });
      setSelectedId(music.id);
      closeDialog();
      await load();
      showToast(editingId ? "自定义背景音乐已更新" : "自定义背景音乐已创建，可在创作中使用", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义背景音乐保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustom = async (music: BackgroundMusicSummary) => {
    if (music.owner_user_id === null) return;
    if (!window.confirm(`确认删除「${music.name}」吗？`)) return;
    try {
      await backgroundMusicLibraryApi.remove(music.id);
      if (selectedId === music.id) setSelectedId(null);
      showToast("自定义背景音乐已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义背景音乐删除失败", "error");
    }
  };

  const handleSetDefault = async (music: BackgroundMusicSummary) => {
    try {
      await backgroundMusicLibraryApi.setDefault(music.id);
      showToast("默认背景音乐已更新", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "默认背景音乐设置失败", "error");
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-8 pb-12 max-sm:px-4">
        <header className="relative py-12 text-center max-sm:py-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(245,166,35,0.1),transparent_70%)]" />
          <h1 className="font-display relative text-[38px] leading-tight text-[var(--text-dark)] max-sm:text-[30px]">背景音乐选择</h1>
          <p className="relative mx-auto mt-2 max-w-[520px] text-base leading-7 text-[var(--text-mid)]">
            选择播放时的背景音乐，或上传一段自己的音频收藏。
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")}>
              系统音乐
              <span className="rounded-full bg-[rgba(245,166,35,0.16)] px-2 py-0.5 text-xs text-[var(--honey)]">{systemItems.length}</span>
            </TabButton>
            <TabButton active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
              自定义音乐
              <span className="rounded-full bg-[rgba(139,198,168,0.16)] px-2 py-0.5 text-xs text-[var(--sage-deep)]">{customItems.length}</span>
            </TabButton>
          </div>
        </div>

        {activeTab === "system" ? (
          <MusicSection
            isLoading={isLoading}
            items={systemItems}
            loadingLabel="正在加载背景音乐库..."
            selectedId={selectedId}
            title="系统背景音乐"
            badge={`${systemItems.length} 首精选`}
            emptyLabel="背景音乐库暂无数据，管理员配置后会展示在这里。"
            onSelect={handleSelect}
          />
        ) : null}

        {activeTab === "custom" ? (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="自定义背景音乐" />
              <Button size="sm" type="button" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新增音乐
              </Button>
            </div>
            {isLoading ? (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载自定义背景音乐...</div>
            ) : customItems.length ? (
              <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {customItems.map((music) => (
                  <MusicCard
                    key={music.id}
                    selected={selectedId === music.id}
                    music={music}
                    onDelete={() => void handleDeleteCustom(music)}
                    onEdit={() => openEdit(music)}
                    onSelect={() => handleSelect(music)}
                    onSetDefault={() => void handleSetDefault(music)}
                  />
                ))}
              </div>
            ) : (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">还没有自定义背景音乐，点击右上角新增。</div>
            )}
          </section>
        ) : null}
      </main>

      <EditDialog
        form={musicForm}
        isOpen={dialogOpen}
        isSaving={isSaving}
        pendingAudioFile={pendingAudioFile}
        title={editingId ? "编辑自定义背景音乐" : "新增自定义背景音乐"}
        onClose={closeDialog}
        onSelectAudio={setPendingAudioFile}
        onSubmit={handleSubmitMusic}
        onUpdate={updateMusicForm}
      />
    </AppShell>
  );
};

const MusicSection: React.FC<{
  badge?: string;
  emptyLabel: string;
  isLoading: boolean;
  items: BackgroundMusicSummary[];
  loadingLabel: string;
  selectedId: number | null;
  title: string;
  onSelect: (music: BackgroundMusicSummary) => void;
}> = ({ badge, emptyLabel, isLoading, items, loadingLabel, selectedId, title, onSelect }) => (
  <section>
    <SectionTitle title={title} badge={badge} />
    {isLoading ? (
      <div className="app-card p-7 text-sm text-[var(--text-light)]">{loadingLabel}</div>
    ) : items.length ? (
      <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {items.map((music) => (
          <MusicCard key={music.id} selected={selectedId === music.id} music={music} onSelect={() => onSelect(music)} />
        ))}
      </div>
    ) : (
      <div className="app-card p-7 text-sm text-[var(--text-light)]">{emptyLabel}</div>
    )}
  </section>
);

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
      <span className="rounded-full bg-[linear-gradient(135deg,var(--honey),var(--sky))] px-2.5 py-1 text-xs font-bold text-white">
        {badge}
      </span>
    ) : null}
  </h2>
);

const MusicCard: React.FC<{
  selected: boolean;
  music: BackgroundMusicSummary;
  onDelete?: () => void;
  onEdit?: () => void;
  onSelect: () => void;
  onSetDefault?: () => void;
}> = ({ selected, music, onDelete, onEdit, onSelect, onSetDefault }) => (
  <article
    className={cn(
      "group relative overflow-hidden rounded-[20px] border-[2.5px] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
      selected ? "border-[var(--honey)] shadow-[0_0_0_3px_rgba(245,166,35,0.18),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
    )}
  >
    {music.is_default ? (
      <span className="absolute left-3.5 top-3.5 z-10 inline-flex items-center gap-1 rounded-full bg-[rgba(245,166,35,0.16)] px-3 py-1 text-xs font-bold text-[var(--honey)]">
        <Star className="h-3.5 w-3.5" />
        默认
      </span>
    ) : null}
    {onEdit || onDelete || onSetDefault ? (
      <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
        {onSetDefault ? (
          <Button aria-label={`设为默认：${music.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onSetDefault}>
            <Star className="h-4 w-4" />
          </Button>
        ) : null}
        {onEdit ? (
          <Button aria-label={`编辑${music.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </Button>
        ) : null}
        {onDelete ? (
          <Button aria-label={`删除${music.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    ) : null}
    <button
      className="relative flex h-[190px] w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,rgba(245,166,35,0.18),rgba(126,200,227,0.16))]"
      type="button"
      onClick={onSelect}
      aria-label={`选择${music.name}`}
    >
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/82 text-[var(--honey)] shadow-[var(--shadow-soft)]">
        <Music2 className="h-12 w-12" />
      </div>
      <span
        className={cn(
          "absolute bottom-4 left-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--honey),var(--sky))] text-white shadow-[0_2px_8px_rgba(245,166,35,0.35)] transition",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      >
        <Check className="h-4 w-4" />
      </span>
    </button>
    <div className="p-5">
      <h3 className="font-display text-xl text-[var(--text-dark)]">{music.name}</h3>
      <p className="mt-2 min-h-[46px] text-[13px] leading-6 text-[var(--text-mid)]">
        {music.description || "适合作为绘本播放时的氛围音乐。"}
        {music.duration_seconds ? ` · ${music.duration_seconds} 秒` : ""}
      </p>
      <audio className="mt-3 h-9 w-full" controls src={music.audio_url} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            music.access_level === "vip"
              ? "bg-[linear-gradient(135deg,rgba(245,166,35,0.15),rgba(255,138,101,0.15))] text-[var(--peach)]"
              : "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]",
          )}
        >
          {music.access_level === "vip" ? "VIP" : "免费"}
        </span>
        <button
          className={cn(
            "rounded-xl border-2 px-4 py-2 text-xs font-bold transition",
            selected
              ? "border-transparent bg-[linear-gradient(135deg,var(--honey),var(--sky))] text-white"
              : "border-[var(--honey)] text-[var(--honey)] group-hover:bg-[var(--honey)] group-hover:text-white",
          )}
          type="button"
          onClick={onSelect}
        >
          {selected ? "已选择" : "选择此音乐"}
        </button>
      </div>
    </div>
  </article>
);

const EditDialog: React.FC<{
  form: MusicFormState;
  isOpen: boolean;
  isSaving: boolean;
  pendingAudioFile: File | null;
  title: string;
  onClose: () => void;
  onSelectAudio: (file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof MusicFormState>(key: K, value: MusicFormState[K]) => void;
}> = ({ form, isOpen, isSaving, pendingAudioFile, title, onClose, onSelectAudio, onSubmit, onUpdate }) => {
  const inputId = React.useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[520px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-background-music-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="custom-background-music-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑个人私有背景音乐卡片信息和音频文件。</p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="flex min-h-[150px] items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(126,200,227,0.24)] bg-[rgba(126,200,227,0.08)]">
              <label className="flex cursor-pointer flex-col items-center text-center" htmlFor={inputId}>
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-[var(--honey)] shadow-[var(--shadow-soft)]">
                  <Upload className="h-10 w-10" />
                </span>
                <span className="mt-3 text-sm font-bold text-[var(--text-dark)]">
                  {pendingAudioFile ? pendingAudioFile.name : form.audio_url ? "更换背景音乐" : "选择背景音乐"}
                </span>
                <span className="mt-1 text-xs text-[var(--text-light)]">支持 MP3 / WAV / M4A</span>
                <input
                  id={inputId}
                  className="sr-only"
                  type="file"
                  accept="audio/*"
                  disabled={isSaving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectAudio(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            <Field label="名称">
              <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="睡前星光" />
            </Field>
            <Field label="描述">
              <textarea
                className="min-h-[96px] w-full resize-none rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[var(--peach)]"
                value={form.description}
                maxLength={1000}
                onChange={(event) => onUpdate("description", event.target.value)}
              />
            </Field>

            {form.audio_url ? (
              <Field label="当前音频">
                <audio className="h-10 w-full" controls src={form.audio_url} />
              </Field>
            ) : null}

            <Field label="时长（秒）">
              <Input inputMode="numeric" value={form.duration_seconds} onChange={(event) => onUpdate("duration_seconds", event.target.value)} placeholder="90" />
            </Field>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存背景音乐"}
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
