import React from "react";
import { Edit3, Headphones, Music2, Plus, Save, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AssetAccessLevel, BackgroundMusicRead, BackgroundMusicSummary } from "@/entities/asset";
import { cn } from "@/lib/utils";
import { useToast } from "@/shared/ui/toast";

import { adminApi } from "./api";
import type { SystemBackgroundMusicWrite } from "./types";

interface MusicFormState {
  name: string;
  description: string;
  audio_url: string;
  duration_seconds: string;
  access_level: AssetAccessLevel;
  sort_order: string;
  status: "active" | "disabled";
}

const emptyForm: MusicFormState = {
  name: "",
  description: "",
  audio_url: "",
  duration_seconds: "",
  access_level: "free",
  sort_order: "0",
  status: "active",
};

const toForm = (music: BackgroundMusicSummary): MusicFormState => ({
  name: music.name,
  description: music.description ?? "",
  audio_url: music.audio_url,
  duration_seconds: music.duration_seconds ? String(music.duration_seconds) : "",
  access_level: music.access_level,
  sort_order: String(music.sort_order),
  status: music.status === "disabled" ? "disabled" : "active",
});

const toPayload = (form: MusicFormState): SystemBackgroundMusicWrite => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  audio_url: form.audio_url.trim(),
  duration_seconds: form.duration_seconds ? Number(form.duration_seconds) || null : null,
  access_level: form.access_level,
  sort_order: Number(form.sort_order) || 0,
  status: form.status,
});

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("音频读取失败"));
    reader.readAsDataURL(file);
  });

export const AdminBackgroundMusicManager: React.FC = () => {
  const [items, setItems] = React.useState<BackgroundMusicSummary[]>([]);
  const [form, setForm] = React.useState<MusicFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editingDetail, setEditingDetail] = React.useState<BackgroundMusicRead | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pendingAudioFile, setPendingAudioFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const { showToast } = useToast();

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listBackgroundMusic();
      setItems(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "背景音乐列表加载失败", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPendingAudioFile(null);
    setDialogOpen(true);
  };

  const openEdit = async (music: BackgroundMusicSummary) => {
    setEditingId(music.id);
    setEditingDetail(null);
    setForm(toForm(music));
    setPendingAudioFile(null);
    setDialogOpen(true);
    try {
      setEditingDetail(await adminApi.getBackgroundMusic(music.id));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "背景音乐详情加载失败", "error");
    }
  };

  const closeDialog = () => {
    if (isSaving || isUploading) return;
    setDialogOpen(false);
    setEditingId(null);
    setEditingDetail(null);
    setForm(emptyForm);
    setPendingAudioFile(null);
  };

  const updateForm = <K extends keyof MusicFormState>(key: K, value: MusicFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const uploadPendingAudio = async () => {
    if (!pendingAudioFile) return form.audio_url.trim();
    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(pendingAudioFile);
      const audio = await adminApi.uploadBackgroundMusicAudio({
        base64: dataUrl,
        mime_type: pendingAudioFile.type || "audio/mpeg",
        filename: pendingAudioFile.name,
      });
      return audio.url;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.name) {
      showToast("请填写背景音乐名称", "error");
      return;
    }
    setIsSaving(true);
    try {
      payload.audio_url = await uploadPendingAudio();
      if (!payload.audio_url) {
        throw new Error("请上传背景音乐音频");
      }
      if (editingId) {
        await adminApi.updateBackgroundMusic(editingId, payload);
        showToast("背景音乐已更新", "success");
      } else {
        await adminApi.createBackgroundMusic(payload);
        showToast("背景音乐已创建", "success");
      }
      closeDialog();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "背景音乐保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (music: BackgroundMusicSummary) => {
    if (!window.confirm(`确认删除「${music.name}」吗？`)) return;
    try {
      await adminApi.deleteBackgroundMusic(music.id);
      showToast("背景音乐已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "背景音乐删除失败", "error");
    }
  };

  return (
    <>
      <section className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">系统背景音乐</h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">管理前台系统背景音乐卡片，音频仅支持手动上传。</p>
          </div>
          <Button size="sm" type="button" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增背景音乐
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            正在加载背景音乐...
          </div>
        ) : items.length ? (
          <div className="mt-5 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            {items.map((music) => (
              <MusicAdminCard
                key={music.id}
                music={music}
                onDelete={() => void handleDelete(music)}
                onEdit={() => void openEdit(music)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            暂无系统背景音乐，点击右上角新增。
          </div>
        )}
      </section>

      <EditDialog
        form={form}
        detail={editingDetail}
        isOpen={dialogOpen}
        isSaving={isSaving}
        isUploading={isUploading}
        pendingAudioFile={pendingAudioFile}
        title={editingId ? "编辑系统背景音乐" : "新增系统背景音乐"}
        onClose={closeDialog}
        onSelectAudio={setPendingAudioFile}
        onSubmit={handleSubmit}
        onUpdate={updateForm}
      />
    </>
  );
};

const MusicAdminCard: React.FC<{
  music: BackgroundMusicSummary;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ music, onDelete, onEdit }) => (
  <article className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(255,248,240,0.72)] shadow-[var(--shadow-soft)]">
    <div className="relative flex h-36 items-center justify-center bg-[linear-gradient(135deg,rgba(245,166,35,0.18),rgba(126,200,227,0.16))]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/86 text-[var(--honey)] shadow-[var(--shadow-soft)]">
        <Music2 className="h-10 w-10" />
      </div>
      <div className="absolute right-3 top-3 flex gap-2">
        <Button aria-label={`编辑${music.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button aria-label={`删除${music.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl">{music.name}</h3>
          <p className="mt-1 text-xs font-bold text-[var(--text-light)]">
            排序 {music.sort_order}
            {music.duration_seconds ? ` · ${music.duration_seconds} 秒` : ""}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-bold",
            music.access_level === "vip"
              ? "bg-[rgba(255,138,101,0.14)] text-[var(--peach)]"
              : "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]",
          )}
        >
          {music.access_level === "vip" ? "VIP" : "免费"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-5 text-[var(--text-mid)]">{music.description || "未填写描述"}</p>
      <audio className="mt-4 h-9 w-full" controls src={music.audio_url} />
      <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--text-light)]">
        <span>{music.status === "active" ? "启用" : "停用"}</span>
        <span>{music.source_type === "system" ? "系统音乐" : "其他来源"}</span>
      </div>
    </div>
  </article>
);

const EditDialog: React.FC<{
  detail: BackgroundMusicRead | null;
  form: MusicFormState;
  isOpen: boolean;
  isSaving: boolean;
  isUploading: boolean;
  pendingAudioFile: File | null;
  title: string;
  onClose: () => void;
  onSelectAudio: (file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof MusicFormState>(key: K, value: MusicFormState[K]) => void;
}> = ({ detail, form, isOpen, isSaving, isUploading, pendingAudioFile, title, onClose, onSelectAudio, onSubmit, onUpdate }) => {
  const inputId = React.useId();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[520px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="background-music-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="background-music-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑系统背景音乐卡片信息、音频、权益和前台状态。</p>
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
                  disabled={isSaving || isUploading}
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

            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
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
                  onChange={(event) => onUpdate("status", event.target.value as MusicFormState["status"])}
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </Field>
              <Field label="排序">
                <Input inputMode="numeric" value={form.sort_order} onChange={(event) => onUpdate("sort_order", event.target.value)} />
              </Field>
              <Field label="时长（秒）">
                <Input inputMode="numeric" value={form.duration_seconds} onChange={(event) => onUpdate("duration_seconds", event.target.value)} />
              </Field>
            </div>

            {form.audio_url ? (
              <Field label="当前音频">
                <audio className="h-10 w-full" controls src={form.audio_url} />
              </Field>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(126,200,227,0.12)] px-3 py-1.5 text-xs font-bold text-[var(--sky-deep)]">
                <Headphones className="h-3.5 w-3.5" />
                保存前需要上传音频
              </div>
            )}

            {detail ? (
              <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(255,248,240,0.72)] p-4">
                <h3 className="text-sm font-bold text-[var(--text-dark)]">引用绘本</h3>
                {detail.referenced_books.length ? (
                  <div className="mt-3 grid gap-2">
                    {detail.referenced_books.map((book) => (
                      <div
                        key={book.id}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-white px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-bold text-[var(--text-dark)]">{book.title}</span>
                        <span className="shrink-0 text-xs text-[var(--text-light)]">#{book.id}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-[var(--text-light)]">暂无绘本引用。</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving || isUploading} type="submit">
            <Save className="h-4 w-4" />
            {isUploading ? "上传音频中..." : isSaving ? "保存中..." : "保存背景音乐"}
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
