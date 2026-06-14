import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Edit3, Image, Loader2, MessageCircle, PlayCircle, Save, Sparkles, Type, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { creationApi } from "../api";
import { StepPanel } from "../components";
import type { CreationSession, PageDraft, PageDraftPatch, PageDraftTaskStatus } from "../types";

type StoryboardFormState = {
  title: string;
  textZh: string;
  textEn: string;
  visualPrompt: string;
};

type PreviewTab = "content" | "visual" | "dialogue" | "playback";

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
  visualPrompt: page.visual_prompt,
});

const toPatchPayload = (page: PageDraft, form: StoryboardFormState): PageDraftPatch => ({
  page_no: page.page_no,
  title: form.title.trim() || null,
  text_zh: form.textZh.trim() || null,
  text_en: form.textEn.trim() || null,
  visual_prompt: form.visualPrompt.trim(),
  character_appearances: page.character_appearances,
  dialogues: page.dialogues,
  playback_segments: page.playback_segments,
  voice_config: page.voice_config,
  subtitle_config: page.subtitle_config,
  lip_sync_config: page.lip_sync_config,
});

export const StoryboardStep: React.FC<{
  isGenerating: boolean;
  session: CreationSession | null;
  targetPageCount: number;
  onGenerateStoryboard: () => void;
  onSessionChange: (session: CreationSession) => void;
  onTargetPageCountChange: (pageCount: number) => void;
}> = ({ isGenerating, session, targetPageCount, onGenerateStoryboard, onSessionChange, onTargetPageCountChange }) => {
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
    <StepPanel icon={<Image className="h-5 w-5" />} title="编辑分镜" desc="确认每页标题、正文和画面描述，下一步会按这些分镜生成插图。">
      <div className="space-y-4">
        <StoryboardControls
          disabled={isGenerating}
          pageCount={targetPageCount}
          pagesReadyCount={pages.length}
          onGenerate={onGenerateStoryboard}
          onPageCountChange={onTargetPageCountChange}
        />

        {error ? (
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[rgba(212,114,92,0.08)] px-4 py-3 text-sm text-[var(--terracotta)]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {!session ? (
          <EmptyState icon={<Image className="h-5 w-5" />} title="还没有创作会话" desc="从上一步进入后会保存角色配置，之后可以在这里生成分镜。" />
        ) : pages.length === 0 ? (
          <EmptyState icon={isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />} title={isGenerating ? "正在生成分镜" : "暂无分镜"} desc={isGenerating ? "任务完成后，每一页的正文和画面描述会显示在这里。" : "设置页数后点击生成分镜，也可以直接去下一步查看已有声音配置。"} />
        ) : (
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
        )}
      </div>
    </StepPanel>
  );
};

const StoryboardControls: React.FC<{
  disabled: boolean;
  pageCount: number;
  pagesReadyCount: number;
  onGenerate: () => void;
  onPageCountChange: (pageCount: number) => void;
}> = ({ disabled, pageCount, pagesReadyCount, onGenerate, onPageCountChange }) => {
  const pageOptions = [6, 8, 10, 12];

  return (
    <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-[var(--text-dark)]">分镜页数</div>
          <div className="mt-1 text-xs text-[var(--text-light)]">当前已有 {pagesReadyCount} 页分镜</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-[var(--radius-sm)] bg-[var(--warm-bg)] p-1">
            {pageOptions.map((option) => {
              const selected = option === pageCount;
              return (
                <button
                  key={option}
                  aria-pressed={selected}
                  className={cn(
                    "h-9 min-w-12 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--peach)]",
                    selected ? "bg-white text-[var(--terracotta)] shadow-[var(--shadow-soft)]" : "text-[var(--text-mid)] hover:bg-white/70",
                  )}
                  disabled={disabled}
                  type="button"
                  onClick={() => onPageCountChange(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <Button type="button" disabled={disabled} onClick={onGenerate}>
            {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {disabled ? "生成中" : pagesReadyCount ? "重新生成分镜" : "生成分镜"}
          </Button>
        </div>
      </div>
    </div>
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
  const playbackCount = page.playback_segments.length;
  const [activeTab, setActiveTab] = useState<PreviewTab>("content");

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
            {playbackCount ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(126,200,227,0.14)] px-2.5 py-1 text-xs font-bold text-[var(--sky-deep)]">
                <PlayCircle className="h-3 w-3" />
                {playbackCount} 段播放
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
        <PageDraftPreview
          activeTab={activeTab}
          appearanceLabels={appearanceLabels}
          dialogueCount={dialogueCount}
          page={page}
          playbackCount={playbackCount}
          onTabChange={setActiveTab}
        />
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
  activeTab: PreviewTab;
  appearanceLabels: string[];
  dialogueCount: number;
  onTabChange: (tab: PreviewTab) => void;
  page: PageDraft;
  playbackCount: number;
}> = ({ activeTab, appearanceLabels, dialogueCount, onTabChange, page, playbackCount }) => (
  <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--warm-bg)]">
      {page.image_url ? (
        <img alt={`${page.title || `第${page.page_no}页`}插图`} className="h-full w-full object-cover" src={page.image_url} />
      ) : (
        <div className="px-4 text-center text-xs font-semibold text-[var(--text-light)]">插图会在下一步生成</div>
      )}
    </div>

    <div className="min-w-0">
      <TabList activeTab={activeTab} dialogueCount={dialogueCount} playbackCount={playbackCount} onTabChange={onTabChange} />
      <div className="mt-4 min-h-[210px] rounded-[var(--radius-sm)] bg-[var(--warm-bg)] p-4">
        {activeTab === "content" ? (
          <div className="grid gap-4">
            <TextBlock label="正文" value={page.text_zh || page.text_en || "暂无正文"} />
            {page.text_en ? <TextBlock label="英文" value={page.text_en} /> : null}
          </div>
        ) : null}
        {activeTab === "visual" ? (
          <div className="grid gap-4">
            <TextBlock label="画面" value={page.visual_prompt} />
            <TokenList emptyText="未指定出场角色" items={appearanceLabels} label="出场" />
          </div>
        ) : null}
        {activeTab === "dialogue" ? <DialogueList page={page} /> : null}
        {activeTab === "playback" ? <PlaybackSegmentList page={page} /> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 font-semibold text-[var(--text-mid)]">
          出场：{appearanceLabels.length ? appearanceLabels.join("、") : "未指定"}
        </span>
        <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 font-semibold text-[var(--text-mid)]">
          对白：{dialogueCount} 条
        </span>
        <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 font-semibold text-[var(--text-mid)]">
          播放：{playbackCount} 段
        </span>
      </div>
    </div>
  </div>
);

const tabMeta: Record<PreviewTab, { icon: React.ReactNode; label: string }> = {
  content: { icon: <Type className="h-3.5 w-3.5" />, label: "内容" },
  visual: { icon: <Sparkles className="h-3.5 w-3.5" />, label: "画面" },
  dialogue: { icon: <MessageCircle className="h-3.5 w-3.5" />, label: "对白" },
  playback: { icon: <PlayCircle className="h-3.5 w-3.5" />, label: "播放" },
};

const TabList: React.FC<{
  activeTab: PreviewTab;
  dialogueCount: number;
  onTabChange: (tab: PreviewTab) => void;
  playbackCount: number;
}> = ({ activeTab, dialogueCount, onTabChange, playbackCount }) => {
  const tabs: Array<{ count?: number; value: PreviewTab }> = [
    { value: "content" },
    { value: "visual" },
    { value: "dialogue", count: dialogueCount },
    { value: "playback", count: playbackCount },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="分镜内容分类">
      {tabs.map((tab) => {
        const meta = tabMeta[tab.value];
        const selected = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            aria-selected={selected}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--peach)]",
              selected
                ? "bg-[rgba(212,114,92,0.12)] text-[var(--terracotta)]"
                : "bg-[rgba(120,120,120,0.08)] text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.08)]",
            )}
            role="tab"
            type="button"
            onClick={() => onTabChange(tab.value)}
          >
            {meta.icon}
            {meta.label}
            {typeof tab.count === "number" ? <span className="text-[var(--text-light)]">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
};

const DialogueList: React.FC<{ page: PageDraft }> = ({ page }) => {
  if (!page.dialogues.length) {
    return <EmptyInlineState text="当前页面没有对白标记" />;
  }
  return (
    <div className="grid gap-3">
      {orderedBySort(page.dialogues).map((dialogue, index) => (
        <div key={`${dialogue.speaker_ref}-${dialogue.sort_order}-${index}`} className="rounded-[var(--radius-sm)] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--text-light)]">
            <span>{dialogue.speaker_ref || "未指定角色"}</span>
            <TimeRange startMs={dialogue.start_ms} endMs={dialogue.end_ms} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-mid)]">{dialogue.text}</p>
        </div>
      ))}
    </div>
  );
};

const PlaybackSegmentList: React.FC<{ page: PageDraft }> = ({ page }) => {
  if (!page.playback_segments.length) {
    return <EmptyInlineState text="当前页面没有播放片段" />;
  }
  return (
    <div className="grid gap-3">
      {orderedBySort(page.playback_segments).map((segment, index) => (
        <div key={`${segment.segment_type}-${segment.sort_order}-${index}`} className="rounded-[var(--radius-sm)] bg-white p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--text-light)]">
            <span>{segment.segment_type === "dialogue" ? "对白" : "旁白"}</span>
            {segment.speaker_ref ? <span>{segment.speaker_ref}</span> : null}
            <TimeRange startMs={segment.start_ms} endMs={segment.end_ms} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-mid)]">{segment.text}</p>
          {(segment.audio_url || segment.lip_sync_url) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[var(--sage-deep)]">
              {segment.audio_url ? <span>已有音频</span> : null}
              {segment.lip_sync_url ? <span>已有对口型</span> : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const TokenList: React.FC<{ emptyText: string; items: string[]; label: string }> = ({ emptyText, items, label }) => (
  <div>
    <div className="text-xs font-bold text-[var(--text-light)]">{label}</div>
    <div className="mt-2 flex flex-wrap gap-2">
      {items.length ? (
        items.map((item) => (
          <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--text-mid)]">
            {item}
          </span>
        ))
      ) : (
        <span className="text-sm text-[var(--text-light)]">{emptyText}</span>
      )}
    </div>
  </div>
);

const TimeRange: React.FC<{ endMs?: number | null; startMs?: number | null }> = ({ endMs, startMs }) => {
  if (typeof startMs !== "number" && typeof endMs !== "number") return null;
  return (
    <span>
      {formatMs(startMs)} - {formatMs(endMs)}
    </span>
  );
};

const EmptyInlineState: React.FC<{ text: string }> = ({ text }) => <p className="text-sm leading-6 text-[var(--text-light)]">{text}</p>;

const orderedBySort = <T extends { sort_order: number }>(items: T[]): T[] => [...items].sort((first, second) => first.sort_order - second.sort_order);

const formatMs = (value?: number | null): string => (typeof value === "number" ? `${(value / 1000).toFixed(1)}s` : "--");

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
