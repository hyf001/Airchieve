import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Edit3, Image, Loader2, Save, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { creationApi } from "../api";
import { StepPanel } from "../components";
import type { CreationSession, PageDraft, PageDraftPatch, PageDraftTaskStatus } from "../types";

type StoryboardFormState = {
  title: string;
  textZh: string;
  textEn: string;
  narrationText: string;
  visualPrompt: string;
};

const statusMeta: Record<PageDraftTaskStatus, { label: string; className: string }> = {
  draft: {
    label: "已修改",
    className: "bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)]",
  },
  pending: {
    label: "生成中",
    className: "bg-[rgba(126,200,227,0.14)] text-[var(--sky-deep)]",
  },
  ready: {
    label: "可生成图片",
    className: "bg-[rgba(94,160,122,0.12)] text-[var(--sage-deep)]",
  },
  failed: {
    label: "生成失败",
    className: "bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)]",
  },
  skipped: {
    label: "已跳过",
    className: "bg-[rgba(120,120,120,0.1)] text-[var(--text-light)]",
  },
};

const toFormState = (page: PageDraft): StoryboardFormState => ({
  title: page.title ?? "",
  textZh: page.text_zh ?? "",
  textEn: page.text_en ?? "",
  narrationText: page.narration_text ?? "",
  visualPrompt: page.visual_prompt,
});

const toPatchPayload = (page: PageDraft, form: StoryboardFormState): PageDraftPatch => ({
  page_no: page.page_no,
  title: form.title.trim() || null,
  text_zh: form.textZh.trim() || null,
  text_en: form.textEn.trim() || null,
  narration_text: form.narrationText.trim() || null,
  visual_prompt: form.visualPrompt.trim(),
  character_appearances: page.character_appearances,
  dialogues: page.dialogues,
  voice_config: page.voice_config,
  subtitle_config: page.subtitle_config,
  lip_sync_config: page.lip_sync_config,
});

export const StoryboardStep: React.FC<{
  session: CreationSession | null;
  onSessionChange: (session: CreationSession) => void;
}> = ({ session, onSessionChange }) => {
  const pages = session?.page_drafts ?? [];
  const [editingPageId, setEditingPageId] = useState<number | null>(null);
  const [form, setForm] = useState<StoryboardFormState | null>(null);
  const [savingPageId, setSavingPageId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = (page: PageDraft) => {
    setEditingPageId(page.id);
    setForm(toFormState(page));
    setError(null);
  };

  const handleCancel = () => {
    setEditingPageId(null);
    setForm(null);
    setError(null);
  };

  const handleFormChange = (field: keyof StoryboardFormState, value: string) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSave = async (page: PageDraft) => {
    if (!session || !form) return;
    if (!form.visualPrompt.trim()) {
      setError("画面描述不能为空");
      return;
    }
    setSavingPageId(page.id);
    setError(null);
    try {
      const updated = await creationApi.updatePageDraft(session.id, page.id, toPatchPayload(page, form));
      onSessionChange(updated);
      setEditingPageId(null);
      setForm(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "分镜保存失败");
    } finally {
      setSavingPageId(null);
    }
  };

  return (
    <StepPanel icon={<Image className="h-5 w-5" />} title="编辑分镜" desc="确认每页标题、正文、朗读文本和画面描述，下一步会按这些分镜生成插图。">
      {!session ? (
        <EmptyState icon={<Loader2 className="h-5 w-5 animate-spin" />} title="正在准备创作会话" desc="请稍候，系统会在角色确认后生成分镜。" />
      ) : pages.length === 0 ? (
        <EmptyState icon={<Loader2 className="h-5 w-5 animate-spin" />} title="等待分镜生成" desc="分镜任务完成后，每一页的正文和画面描述会显示在这里。" />
      ) : (
        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[rgba(212,114,92,0.08)] px-4 py-3 text-sm text-[var(--terracotta)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="grid gap-4">
            {pages.map((page) => {
              const isEditing = editingPageId === page.id;
              return (
                <PageDraftCard
                  key={page.id}
                  form={isEditing ? form : null}
                  isEditing={isEditing}
                  page={page}
                  saving={savingPageId === page.id}
                  onCancel={handleCancel}
                  onEdit={() => handleEdit(page)}
                  onFormChange={handleFormChange}
                  onSave={() => void handleSave(page)}
                />
              );
            })}
          </div>
        </div>
      )}
    </StepPanel>
  );
};

const PageDraftCard: React.FC<{
  form: StoryboardFormState | null;
  isEditing: boolean;
  page: PageDraft;
  saving: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onFormChange: (field: keyof StoryboardFormState, value: string) => void;
  onSave: () => void;
}> = ({ form, isEditing, page, saving, onCancel, onEdit, onFormChange, onSave }) => {
  const meta = statusMeta[page.storyboard_status];
  const appearanceLabels = page.character_appearances
    .map((appearance) => String(appearance.display_name ?? appearance.character_ref ?? appearance.role_code ?? "").trim())
    .filter(Boolean);
  const dialogueCount = page.dialogues.length;

  return (
    <article className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">第 {page.page_no} 页</span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", meta.className)}>{meta.label}</span>
            {page.image_url ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(94,160,122,0.1)] px-2.5 py-1 text-xs font-bold text-[var(--sage-deep)]">
                <CheckCircle2 className="h-3 w-3" />
                已有插图
              </span>
            ) : null}
            {page.audio_url ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(126,200,227,0.14)] px-2.5 py-1 text-xs font-bold text-[var(--sky-deep)]">
                <Volume2 className="h-3 w-3" />
                已有音频
              </span>
            ) : null}
          </div>
          {!isEditing ? <h3 className="mt-3 text-base font-bold text-[var(--text-dark)]">{page.title || "未命名分镜"}</h3> : null}
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
              取消
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={onSave}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "保存中" : "保存"}
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
            <Edit3 className="h-3.5 w-3.5" />
            编辑
          </Button>
        )}
      </div>

      {isEditing && form ? (
        <PageDraftForm form={form} onChange={onFormChange} />
      ) : (
        <PageDraftPreview appearanceLabels={appearanceLabels} dialogueCount={dialogueCount} page={page} />
      )}
    </article>
  );
};

const PageDraftForm: React.FC<{
  form: StoryboardFormState;
  onChange: (field: keyof StoryboardFormState, value: string) => void;
}> = ({ form, onChange }) => (
  <div className="mt-4 grid gap-3">
    <Field label="页标题">
      <input
        className="h-10 w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.12)] px-3 text-sm outline-none focus:border-[var(--peach)]"
        maxLength={160}
        value={form.title}
        onChange={(event) => onChange("title", event.target.value)}
      />
    </Field>
    <Field label="中文正文">
      <textarea
        className="min-h-[96px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--peach)]"
        maxLength={1200}
        value={form.textZh}
        onChange={(event) => onChange("textZh", event.target.value)}
      />
    </Field>
    <Field label="英文正文">
      <textarea
        className="min-h-[80px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--peach)]"
        maxLength={1600}
        value={form.textEn}
        onChange={(event) => onChange("textEn", event.target.value)}
      />
    </Field>
    <Field label="朗读文本">
      <textarea
        className="min-h-[80px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--peach)]"
        maxLength={1600}
        value={form.narrationText}
        onChange={(event) => onChange("narrationText", event.target.value)}
      />
    </Field>
    <Field label="画面描述">
      <textarea
        className="min-h-[112px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--peach)]"
        maxLength={2000}
        required
        value={form.visualPrompt}
        onChange={(event) => onChange("visualPrompt", event.target.value)}
      />
    </Field>
  </div>
);

const PageDraftPreview: React.FC<{
  appearanceLabels: string[];
  dialogueCount: number;
  page: PageDraft;
}> = ({ appearanceLabels, dialogueCount, page }) => (
  <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--warm-bg)]">
      {page.image_url ? (
        <img alt={`${page.title || `第${page.page_no}页`}插图`} className="h-full w-full object-cover" src={page.image_url} />
      ) : (
        <div className="px-4 text-center text-xs font-semibold text-[var(--text-light)]">插图会在下一步生成</div>
      )}
    </div>

    <div className="min-w-0 space-y-3">
      <TextBlock label="正文" value={page.text_zh || page.text_en || "暂无正文"} />
      <TextBlock label="朗读" value={page.narration_text || page.text_zh || page.text_en || "默认沿用正文"} />
      <TextBlock label="画面" value={page.visual_prompt} />
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 font-semibold text-[var(--text-mid)]">
          出场：{appearanceLabels.length ? appearanceLabels.join("、") : "未指定"}
        </span>
        <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 font-semibold text-[var(--text-mid)]">
          对白：{dialogueCount} 条
        </span>
      </div>
    </div>
  </div>
);

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ children, label }) => (
  <label className="grid gap-1.5 text-sm font-semibold text-[var(--text-mid)]">
    {label}
    {children}
  </label>
);

const TextBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-xs font-bold text-[var(--text-light)]">{label}</div>
    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-mid)]">{value}</p>
  </div>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="rounded-[var(--radius-md)] border border-dashed border-[rgba(212,114,92,0.2)] bg-[var(--warm-bg)] p-5 text-sm">
    <div className="flex items-start gap-3 text-[var(--text-mid)]">
      <div className="rounded-[var(--radius-sm)] bg-white p-2 text-[var(--terracotta)] shadow-[var(--shadow-soft)]">{icon}</div>
      <div>
        <h3 className="font-bold text-[var(--text-dark)]">{title}</h3>
        <p className="mt-1 leading-6 text-[var(--text-light)]">{desc}</p>
      </div>
    </div>
  </div>
);
