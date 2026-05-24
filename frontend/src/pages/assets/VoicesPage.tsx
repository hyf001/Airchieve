import React, { useEffect, useMemo, useState } from "react";
import { Check, Edit3, Headphones, Mic2, Plus, Save, Star, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aliyunVoiceLabelMap, aliyunVoiceOptions } from "@/entities/asset/aliyunVoiceOptions";
import type { VoiceSummary } from "@/entities/asset";
import { useTaxonomyGroup } from "@/entities/taxonomy";
import { useAuth } from "@/features/auth";
import { voiceLibraryApi, type VoiceCreatePayload } from "@/features/voice-library";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

interface VoiceFormState {
  name: string;
  voice_style_code: string;
  sample_url: string;
  duration_seconds: string;
}

const emptyVoiceForm: VoiceFormState = {
  name: "",
  voice_style_code: "",
  sample_url: "",
  duration_seconds: "",
};

const toForm = (voice: VoiceSummary): VoiceFormState => ({
  name: voice.name,
  voice_style_code: voice.voice_style_code ?? "",
  sample_url: voice.sample_url ?? "",
  duration_seconds: voice.duration_seconds ? String(voice.duration_seconds) : "",
});

const toPayload = (form: VoiceFormState): VoiceCreatePayload => ({
  name: form.name.trim(),
  voice_style_code: form.voice_style_code.trim() || null,
  sample_url: form.sample_url.trim() || null,
  duration_seconds: form.duration_seconds ? Number(form.duration_seconds) || null : null,
});

export const VoicesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"system" | "custom">("system");
  const [voices, setVoices] = useState<VoiceSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [voiceForm, setVoiceForm] = useState<VoiceFormState>(emptyVoiceForm);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { isAuthenticated } = useAuth();
  const { labelMap: voiceStyleLabelMap } = useTaxonomyGroup("voice_style");
  const { showToast } = useToast();

  const systemVoices = useMemo(() => voices.filter((voice) => voice.owner_user_id === null), [voices]);
  const customVoices = useMemo(() => voices.filter((voice) => voice.owner_user_id !== null), [voices]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await voiceLibraryApi.list();
      setVoices(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "声音库加载失败", "error");
      setVoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (voice: VoiceSummary) => {
    setSelectedId((current) => (current === voice.id ? null : voice.id));
    showToast(`已选择「${voice.name}」声音`, "success");
  };

  const openCreate = () => {
    if (!isAuthenticated) {
      showToast("登录后可以新增自定义声音", "error");
      return;
    }
    setEditingId(null);
    setVoiceForm(emptyVoiceForm);
    setPendingAudioFile(null);
    setDialogOpen(true);
  };

  const openEdit = (voice: VoiceSummary) => {
    if (voice.owner_user_id === null) return;
    setEditingId(voice.id);
    setVoiceForm(toForm(voice));
    setPendingAudioFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setDialogOpen(false);
    setEditingId(null);
    setVoiceForm(emptyVoiceForm);
    setPendingAudioFile(null);
  };

  const updateVoiceForm = <K extends keyof VoiceFormState>(key: K, value: VoiceFormState[K]) => {
    setVoiceForm((current) => ({ ...current, [key]: value }));
  };

  const handleSelectAudio = (file: File) => {
    setPendingAudioFile(file);
  };

  const uploadPendingAudio = async () => {
    if (!pendingAudioFile) return voiceForm.sample_url.trim() || null;
    const session = await voiceLibraryApi.createUploadSession({
      purpose: "voice",
      filename: pendingAudioFile.name,
      mime_type: pendingAudioFile.type || "audio/mpeg",
      byte_size: pendingAudioFile.size,
    });
    await voiceLibraryApi.uploadToStorage(session, pendingAudioFile);
    const asset = await voiceLibraryApi.completeUpload(session.id, {
      byte_size: pendingAudioFile.size,
      asset_kind: "audio",
      visibility: "private",
    });
    return asset.url;
  };

  const handleSubmitVoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(voiceForm);
    if (!payload.name) {
      showToast("请填写声音名称", "error");
      return;
    }
    if (!isAuthenticated) {
      showToast("登录后可以新增自定义声音", "error");
      return;
    }

    setIsSaving(true);
    try {
      payload.sample_url = await uploadPendingAudio();
      const voice = editingId ? await voiceLibraryApi.update(editingId, payload) : await voiceLibraryApi.create(payload);
      setSelectedId(voice.id);
      closeDialog();
      await load();
      showToast(editingId ? "自定义声音已更新" : "自定义声音已创建，可在创作中使用", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义声音保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustom = async (voice: VoiceSummary) => {
    if (voice.owner_user_id === null) return;
    if (!window.confirm(`确认删除「${voice.name}」吗？`)) return;
    try {
      await voiceLibraryApi.remove(voice.id);
      if (selectedId === voice.id) setSelectedId(null);
      showToast("自定义声音已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义声音删除失败", "error");
    }
  };

  const handleSetDefault = async (voice: VoiceSummary) => {
    try {
      await voiceLibraryApi.setDefault(voice.id);
      showToast("默认声音已更新", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "默认声音设置失败", "error");
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-8 pb-12 max-sm:px-4">
        <header className="relative py-12 text-center max-sm:py-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(126,200,227,0.11),transparent_70%)]" />
          <h1 className="font-display relative text-[38px] leading-tight text-[var(--text-dark)] max-sm:text-[30px]">声音选择</h1>
          <p className="relative mx-auto mt-2 max-w-[520px] text-base leading-7 text-[var(--text-mid)]">
            选择朗读声音，让绘本在播放时拥有更合适的语气和节奏。
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")}>
              系统声音
              <span className="rounded-full bg-[rgba(126,200,227,0.16)] px-2 py-0.5 text-xs text-[var(--sky-deep)]">{systemVoices.length}</span>
            </TabButton>
            <TabButton active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
              自定义声音
              <span className="rounded-full bg-[rgba(139,198,168,0.16)] px-2 py-0.5 text-xs text-[var(--sage-deep)]">{customVoices.length}</span>
            </TabButton>
          </div>
        </div>

        {activeTab === "system" ? (
          <section>
            <SectionTitle title="系统声音" badge={`${systemVoices.length} 种精选`} />
            {isLoading ? (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载声音库...</div>
            ) : systemVoices.length ? (
              <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {systemVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    selected={selectedId === voice.id}
                    voice={voice}
                    voiceStyleLabelMap={voiceStyleLabelMap}
                    onSelect={() => handleSelect(voice)}
                  />
                ))}
              </div>
            ) : (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">声音库暂无数据，管理员配置后会展示在这里。</div>
            )}
          </section>
        ) : null}

        {activeTab === "custom" ? (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="自定义声音" />
              <Button size="sm" type="button" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新增声音
              </Button>
            </div>
            {isLoading ? (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载自定义声音...</div>
            ) : customVoices.length ? (
              <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {customVoices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    selected={selectedId === voice.id}
                    voice={voice}
                    voiceStyleLabelMap={voiceStyleLabelMap}
                    onDelete={() => void handleDeleteCustom(voice)}
                    onEdit={() => openEdit(voice)}
                    onSelect={() => handleSelect(voice)}
                    onSetDefault={() => void handleSetDefault(voice)}
                  />
                ))}
              </div>
            ) : (
              <div className="app-card p-7 text-sm text-[var(--text-light)]">还没有自定义声音，点击右上角新增。</div>
            )}
          </section>
        ) : null}
      </main>

      <EditDialog
        form={voiceForm}
        isOpen={dialogOpen}
        isSaving={isSaving}
        pendingAudioFile={pendingAudioFile}
        title={editingId ? "编辑自定义声音" : "新增自定义声音"}
        voiceStyleLabelMap={voiceStyleLabelMap}
        onClose={closeDialog}
        onSelectAudio={handleSelectAudio}
        onSubmit={handleSubmitVoice}
        onUpdate={updateVoiceForm}
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
      <span className="rounded-full bg-[linear-gradient(135deg,var(--sky),var(--sage))] px-2.5 py-1 text-xs font-bold text-white">
        {badge}
      </span>
    ) : null}
  </h2>
);

const VoiceCard: React.FC<{
  selected: boolean;
  voice: VoiceSummary;
  voiceStyleLabelMap: Record<string, string>;
  onDelete?: () => void;
  onEdit?: () => void;
  onSelect: () => void;
  onSetDefault?: () => void;
}> = ({ selected, voice, voiceStyleLabelMap, onDelete, onEdit, onSelect, onSetDefault }) => {
  const styleLabel = voice.voice_style_code
    ? aliyunVoiceLabelMap[voice.voice_style_code] ?? voiceStyleLabelMap[voice.voice_style_code] ?? voice.voice_style_code
    : "未设置音色";
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[20px] border-[2.5px] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
        selected ? "border-[var(--sky)] shadow-[0_0_0_3px_rgba(126,200,227,0.18),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
      )}
    >
      {voice.is_default ? (
        <span className="absolute left-3.5 top-3.5 z-10 inline-flex items-center gap-1 rounded-full bg-[rgba(245,166,35,0.16)] px-3 py-1 text-xs font-bold text-[var(--honey)]">
          <Star className="h-3.5 w-3.5" />
          默认
        </span>
      ) : null}
      {onEdit || onDelete || onSetDefault ? (
        <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
          {onSetDefault ? (
            <Button aria-label={`设为默认：${voice.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onSetDefault}>
              <Star className="h-4 w-4" />
            </Button>
          ) : null}
          {onEdit ? (
            <Button aria-label={`编辑${voice.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onEdit}>
              <Edit3 className="h-4 w-4" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button aria-label={`删除${voice.name}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ) : null}
      <button
        className="relative flex h-[190px] w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,rgba(126,200,227,0.18),rgba(139,198,168,0.16))]"
        type="button"
        onClick={onSelect}
        aria-label={`选择${voice.name}`}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/82 text-[var(--sky-deep)] shadow-[var(--shadow-soft)]">
          <Mic2 className="h-12 w-12" />
        </div>
        <span
          className={cn(
            "absolute bottom-4 left-4 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--sky),var(--sage))] text-white shadow-[0_2px_8px_rgba(126,200,227,0.35)] transition",
            selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        >
          <Check className="h-4 w-4" />
        </span>
      </button>
      <div className="p-5">
        <h3 className="font-display text-xl text-[var(--text-dark)]">{voice.name}</h3>
        <p className="mt-2 min-h-[46px] text-[13px] leading-6 text-[var(--text-mid)]">
          {styleLabel}
          {voice.duration_seconds ? ` · ${voice.duration_seconds} 秒` : ""}
        </p>
        {voice.sample_url ? (
          <audio className="mt-3 h-9 w-full" controls src={voice.sample_url} />
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[rgba(126,200,227,0.12)] px-3 py-1.5 text-xs font-bold text-[var(--sky-deep)]">
            <Headphones className="h-3.5 w-3.5" />
            暂无试听
          </div>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              voice.access_level === "vip"
                ? "bg-[linear-gradient(135deg,rgba(245,166,35,0.15),rgba(255,138,101,0.15))] text-[var(--peach)]"
                : "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]",
            )}
          >
            {voice.access_level === "vip" ? "VIP" : "免费"}
          </span>
          <button
            className={cn(
              "rounded-xl border-2 px-4 py-2 text-xs font-bold transition",
              selected
                ? "border-transparent bg-[linear-gradient(135deg,var(--sky),var(--sage))] text-white"
                : "border-[var(--sky)] text-[var(--sky-deep)] group-hover:bg-[var(--sky)] group-hover:text-white",
            )}
            type="button"
            onClick={onSelect}
          >
            {selected ? "已选择" : "选择此声音"}
          </button>
        </div>
      </div>
    </article>
  );
};

const EditDialog: React.FC<{
  form: VoiceFormState;
  isOpen: boolean;
  isSaving: boolean;
  pendingAudioFile: File | null;
  title: string;
  voiceStyleLabelMap: Record<string, string>;
  onClose: () => void;
  onSelectAudio: (file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof VoiceFormState>(key: K, value: VoiceFormState[K]) => void;
}> = ({ form, isOpen, isSaving, pendingAudioFile, title, voiceStyleLabelMap, onClose, onSelectAudio, onSubmit, onUpdate }) => {
  const inputId = React.useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[520px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-voice-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="custom-voice-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑个人私有声音卡片信息、试听音频和声音风格。</p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="flex min-h-[150px] items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(126,200,227,0.24)] bg-[rgba(126,200,227,0.08)]">
              <label className="flex cursor-pointer flex-col items-center text-center" htmlFor={inputId}>
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-[var(--sky-deep)] shadow-[var(--shadow-soft)]">
                  <Upload className="h-10 w-10" />
                </span>
                <span className="mt-3 text-sm font-bold text-[var(--text-dark)]">
                  {pendingAudioFile ? pendingAudioFile.name : form.sample_url ? "更换试听音频" : "选择试听音频"}
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

            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="名称">
                <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="温柔姐姐" />
              </Field>
              <Field label="阿里云音色">
                <select
                  className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm"
                  value={form.voice_style_code}
                  onChange={(event) => onUpdate("voice_style_code", event.target.value)}
                >
                  <option value="">未设置</option>
                  <optgroup label="多情感音色">
                    {aliyunVoiceOptions
                      .filter((option) => option.supportedEmotions.length > 0)
                      .map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="通用音色">
                    {aliyunVoiceOptions
                      .filter((option) => option.supportedEmotions.length === 0)
                      .map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </Field>
            </div>

            {form.sample_url ? (
              <Field label="当前试听">
                <audio className="h-10 w-full" controls src={form.sample_url} />
              </Field>
            ) : null}

            <Field label="时长（秒）">
              <Input inputMode="numeric" value={form.duration_seconds} onChange={(event) => onUpdate("duration_seconds", event.target.value)} placeholder="30" />
            </Field>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存声音"}
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
