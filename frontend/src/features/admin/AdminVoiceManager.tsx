import React from "react";
import { Edit3, Headphones, Mic2, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aliyunVoiceLabelMap, aliyunVoiceOptions, voiceEmotionLabelMap, voiceEmotionOptions } from "@/entities/asset/aliyunVoiceOptions";
import type { AssetAccessLevel, VoiceSummary } from "@/entities/asset";
import { useTaxonomyGroup } from "@/entities/taxonomy";
import { cn } from "@/lib/utils";
import { useToast } from "@/shared/ui/toast";

import { adminApi } from "./api";
import type { SystemVoiceWrite } from "./types";

interface VoiceFormState {
  name: string;
  voice_style_code: string;
  emotion_type: string;
  sample_text: string;
  sample_url: string;
  duration_seconds: string;
  access_level: AssetAccessLevel;
  status: "active" | "disabled";
}

const emptyForm: VoiceFormState = {
  name: "",
  voice_style_code: "",
  emotion_type: "",
  sample_text: "你好呀，欢迎来到今天的绘本时间。让我们一起听一个温暖的小故事。",
  sample_url: "",
  duration_seconds: "",
  access_level: "free",
  status: "active",
};

const toForm = (voice: VoiceSummary): VoiceFormState => ({
  name: voice.name,
  voice_style_code: voice.voice_style_code ?? "",
  emotion_type: voice.emotion_type ?? "",
  sample_text: emptyForm.sample_text,
  sample_url: voice.sample_url ?? "",
  duration_seconds: voice.duration_seconds ? String(voice.duration_seconds) : "",
  access_level: voice.access_level,
  status: voice.status === "disabled" ? "disabled" : "active",
});

const toPayload = (form: VoiceFormState): SystemVoiceWrite => ({
  name: form.name.trim(),
  voice_style_code: form.voice_style_code.trim() || null,
  emotion_type: form.emotion_type.trim() || null,
  sample_url: form.sample_url.trim() || null,
  duration_seconds: form.duration_seconds ? Number(form.duration_seconds) || null : null,
  access_level: form.access_level,
  status: form.status,
});

export const AdminVoiceManager: React.FC = () => {
  const [items, setItems] = React.useState<VoiceSummary[]>([]);
  const [form, setForm] = React.useState<VoiceFormState>(emptyForm);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = React.useState(false);
  const [sampleTaskProgress, setSampleTaskProgress] = React.useState<number | null>(null);
  const { labelMap: voiceStyleLabelMap } = useTaxonomyGroup("voice_style");
  const { showToast } = useToast();

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listVoices();
      setItems(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "声音列表加载失败", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const updateForm = <K extends keyof VoiceFormState>(key: K, value: VoiceFormState[K]) => {
    setForm((current) => {
      if (key === "voice_style_code") {
        const selected = aliyunVoiceOptions.find((option) => option.code === value);
        const supportedEmotions = selected?.supportedEmotions ?? [];
        return {
          ...current,
          name: selected?.label ?? current.name,
          voice_style_code: String(value),
          emotion_type: supportedEmotions.includes(current.emotion_type) ? current.emotion_type : "",
        };
      }
      return { ...current, [key]: value };
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSampleTaskProgress(null);
    setDialogOpen(true);
  };

  const openEdit = (voice: VoiceSummary) => {
    setEditingId(voice.id);
    setForm(toForm(voice));
    setSampleTaskProgress(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving || isGeneratingSample) return;
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setSampleTaskProgress(null);
  };

  const waitForSampleTask = async (taskId: number) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const task = await adminApi.getGenerationTask(taskId);
      setSampleTaskProgress(task.progress_percent);
      if (task.status === "succeeded") {
        const sampleUrl = typeof task.result_refs?.sample_url === "string" ? task.result_refs.sample_url : null;
        if (!sampleUrl) throw new Error("样例声音任务未返回音频地址");
        return sampleUrl;
      }
      if (task.status === "failed" || task.status === "canceled") {
        throw new Error(task.error_message || "样例声音生成失败");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    throw new Error("样例声音生成超时，请稍后查看任务状态");
  };

  const handleGenerateSample = async () => {
    if (!form.voice_style_code.trim()) {
      showToast("请先选择音色", "error");
      return;
    }
    if (!form.sample_text.trim()) {
      showToast("请输入试听文本", "error");
      return;
    }
    setIsGeneratingSample(true);
    try {
      const audio = await adminApi.generateVoiceSample({
        voice_id: editingId,
        voice_style_code: form.voice_style_code.trim(),
        emotion_type: form.emotion_type.trim() || null,
        sample_text: form.sample_text.trim(),
      });
      showToast(`样例声音任务已创建 #${audio.id}`, "success");
      setSampleTaskProgress(audio.progress_percent);
      const sampleUrl = await waitForSampleTask(audio.id);
      setForm((current) => ({ ...current, sample_url: sampleUrl }));
      showToast("样例声音已生成", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "样例声音生成失败", "error");
    } finally {
      setIsGeneratingSample(false);
      setSampleTaskProgress(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload.name) {
      showToast("请填写声音名称", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await adminApi.updateVoice(editingId, payload);
        showToast("声音已更新", "success");
      } else {
        await adminApi.createVoice(payload);
        showToast("声音已创建", "success");
      }
      closeDialog();
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "声音保存失败", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (voice: VoiceSummary) => {
    if (!window.confirm(`确认删除「${voice.name}」吗？`)) return;
    try {
      await adminApi.deleteVoice(voice.id);
      showToast("声音已删除", "success");
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "声音删除失败", "error");
    }
  };

  return (
    <>
      <section className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">系统声音</h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">管理前台系统声音卡片，删除会从前台列表隐藏。</p>
          </div>
          <Button size="sm" type="button" variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增系统声音
          </Button>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            正在加载声音...
          </div>
        ) : items.length ? (
          <div className="mt-5 grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-md:grid-cols-1">
            {items.map((voice) => (
              <VoiceAdminCard
                key={voice.id}
                voice={voice}
                voiceStyleLabelMap={voiceStyleLabelMap}
                onDelete={() => void handleDelete(voice)}
                onEdit={() => openEdit(voice)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.08)] p-8 text-center text-sm text-[var(--text-light)]">
            暂无系统声音，点击右上角新增。
          </div>
        )}
      </section>

      <EditDialog
        form={form}
        isOpen={dialogOpen}
        isGeneratingSample={isGeneratingSample}
        isSaving={isSaving}
        sampleTaskProgress={sampleTaskProgress}
        title={editingId ? "编辑系统声音" : "新增系统声音"}
        onClose={closeDialog}
        onGenerateSample={() => void handleGenerateSample()}
        onSubmit={handleSubmit}
        onUpdate={updateForm}
      />
    </>
  );
};

const VoiceAdminCard: React.FC<{
  voice: VoiceSummary;
  voiceStyleLabelMap: Record<string, string>;
  onDelete: () => void;
  onEdit: () => void;
}> = ({ voice, voiceStyleLabelMap, onDelete, onEdit }) => {
  const styleLabel = voice.voice_style_code
    ? aliyunVoiceLabelMap[voice.voice_style_code] ?? voiceStyleLabelMap[voice.voice_style_code] ?? voice.voice_style_code
    : "未设置音色";
  const emotionLabel = voice.emotion_type ? voiceEmotionLabelMap[voice.emotion_type] ?? voice.emotion_type : null;
  return (
    <article className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(255,248,240,0.72)] shadow-[var(--shadow-soft)]">
      <div className="relative flex h-36 items-center justify-center bg-[linear-gradient(135deg,rgba(126,200,227,0.18),rgba(139,198,168,0.14))]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/86 text-[var(--sky-deep)] shadow-[var(--shadow-soft)]">
          <Mic2 className="h-10 w-10" />
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <Button aria-label={`编辑${voice.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button aria-label={`删除${voice.name}`} size="icon" type="button" variant="ghost" className="bg-white/90" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl">{voice.name}</h3>
            <p className="mt-1 text-xs font-bold text-[var(--text-light)]">
              {styleLabel}
              {emotionLabel ? ` · ${emotionLabel}` : ""}
              {voice.duration_seconds ? ` · ${voice.duration_seconds} 秒` : ""}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              voice.access_level === "vip"
                ? "bg-[rgba(255,138,101,0.14)] text-[var(--peach)]"
                : "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]",
            )}
          >
            {voice.access_level === "vip" ? "VIP" : "免费"}
          </span>
        </div>
        {voice.sample_url ? (
          <audio className="mt-4 h-9 w-full" controls src={voice.sample_url} />
        ) : (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--text-light)]">
            <Headphones className="h-3.5 w-3.5" />
            未配置试听
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-xs font-bold text-[var(--text-light)]">
          <span>{voice.status === "active" ? "启用" : "停用"}</span>
          <span>{voice.source_type === "system" ? "系统声音" : "其他来源"}</span>
        </div>
      </div>
    </article>
  );
};

const EditDialog: React.FC<{
  form: VoiceFormState;
  isOpen: boolean;
  isGeneratingSample: boolean;
  isSaving: boolean;
  sampleTaskProgress: number | null;
  title: string;
  onClose: () => void;
  onGenerateSample: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof VoiceFormState>(key: K, value: VoiceFormState[K]) => void;
}> = ({ form, isOpen, isGeneratingSample, isSaving, sampleTaskProgress, title, onClose, onGenerateSample, onSubmit, onUpdate }) => {
  const selectedVoice = aliyunVoiceOptions.find((option) => option.code === form.voice_style_code);
  const supportedEmotionSet = new Set(selectedVoice?.supportedEmotions ?? []);
  const availableEmotionOptions = voiceEmotionOptions.filter((option) => supportedEmotionSet.has(option.code));
  const canGenerateSample = Boolean(form.voice_style_code.trim() && form.sample_text.trim()) && !isSaving && !isGeneratingSample;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[520px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-dialog-title"
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="voice-dialog-title" className="font-display text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">编辑系统声音卡片信息、样例声音和前台状态。</p>
          </div>
          <Button aria-label="关闭编辑框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <Field label="名称">
                <Input value={form.name} onChange={(event) => onUpdate("name", event.target.value)} placeholder="温柔姐姐" />
              </Field>
              <Field label="音色">
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

            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-1">
              <Field label="情感类型">
                <select
                  className="h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm disabled:bg-[rgba(242,236,229,0.45)]"
                  value={form.emotion_type}
                  disabled={availableEmotionOptions.length === 0}
                  onChange={(event) => onUpdate("emotion_type", event.target.value)}
                >
                  <option value="">{availableEmotionOptions.length ? "不设置" : "该音色不支持"}</option>
                  {availableEmotionOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
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
                  onChange={(event) => onUpdate("status", event.target.value as VoiceFormState["status"])}
                >
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </Field>
              <Field label="时长（秒）">
                <Input inputMode="numeric" value={form.duration_seconds} onChange={(event) => onUpdate("duration_seconds", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 rounded-[var(--radius-md)] border-2 border-dashed border-[rgba(126,200,227,0.24)] bg-[rgba(126,200,227,0.08)] p-4">
              <Field label="试听文本">
                <textarea
                  className="min-h-[112px] w-full resize-none rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 py-3 text-sm leading-6 outline-none transition focus:border-[var(--peach)]"
                  value={form.sample_text}
                  maxLength={500}
                  disabled={isSaving || isGeneratingSample}
                  onChange={(event) => onUpdate("sample_text", event.target.value)}
                />
              </Field>
              <Button className="w-full" disabled={!canGenerateSample} type="button" variant="sage" onClick={onGenerateSample}>
                {isGeneratingSample ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGeneratingSample
                  ? `生成中${sampleTaskProgress !== null ? ` ${sampleTaskProgress}%` : "..."}`
                  : form.sample_url
                    ? "重新生成样例声音"
                    : "生成样例声音"}
              </Button>
              {form.sample_url ? <audio className="h-10 w-full" controls src={form.sample_url} /> : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={isSaving} type="submit">
            <Save className="h-4 w-4" />
            {isSaving ? "保存中..." : "保存系统声音"}
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
