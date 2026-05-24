import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenText, Loader2, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type GenerationTaskRead, generationTaskApi } from "@/entities/generation-task";
import { StoryCard, StoryEditor, type StoryDetail, type StoryGeneratePayload, type StoryPayload, type StorySummary } from "@/entities/story";
import { useTaxonomyGroup } from "@/entities/taxonomy";
import { storyLibraryApi } from "@/features/story-library";
import { cn } from "@/lib/utils";
import { useRouter } from "@/app/router";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

type StoryTab = "all" | "system" | "user";
type StoryCreateMode = "ai" | "paste";

export const StoriesPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const ageRanges = useTaxonomyGroup("age_range");
  const themes = useTaxonomyGroup("theme");
  const educationGoals = useTaxonomyGroup("education_goal");
  const narrativeStyles = useTaxonomyGroup("narrative_style");
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [tab, setTab] = useState<StoryTab>("all");
  const [activeStory, setActiveStory] = useState<StorySummary | null>(null);
  const [drawerMode, setDrawerMode] = useState<StoryCreateMode>("ai");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailStory, setDetailStory] = useState<StoryDetail | null>(null);
  const [editStory, setEditStory] = useState<StoryDetail | null>(null);
  const [storyTask, setStoryTask] = useState<GenerationTaskRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await storyLibraryApi.listStories();
      setStories(response.items);
      setActiveStory((current) => current ?? response.items[0] ?? null);
      setError(null);
    } catch (requestError) {
      setStories([]);
      setActiveStory(null);
      setError(requestError instanceof Error ? requestError.message : "故事列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!storyTask || storyTask.status === "succeeded" || storyTask.status === "failed" || storyTask.status === "canceled") return;
    const timer = window.setInterval(async () => {
      try {
        const nextTask = await generationTaskApi.getTask(storyTask.id);
        setStoryTask(nextTask);
        if (nextTask.status === "succeeded") {
          showToast("AI 故事已生成", "success");
          setDrawerOpen(false);
          await load();
        }
        if (nextTask.status === "failed") {
          showToast(nextTask.error_message ?? "AI 故事生成失败", "error");
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "故事生成状态获取失败");
      }
    }, 2200);
    return () => window.clearInterval(timer);
  }, [load, showToast, storyTask]);

  const systemStories = useMemo(() => stories.filter((story) => story.source_type === "system"), [stories]);
  const userStories = useMemo(() => stories.filter((story) => story.source_type !== "system"), [stories]);
  const visibleStories = useMemo(
    () => stories.filter((story) => tab === "all" || (tab === "system" ? story.source_type === "system" : story.source_type !== "system")),
    [stories, tab],
  );
  const taxonomyLabels = useMemo(
    () => ({
      ageRange: ageRanges.labelMap,
      theme: themes.labelMap,
      educationGoal: educationGoals.labelMap,
      narrativeStyle: narrativeStyles.labelMap,
    }),
    [ageRanges.labelMap, educationGoals.labelMap, narrativeStyles.labelMap, themes.labelMap],
  );

  const openCreateDrawer = (mode: StoryCreateMode) => {
    setDrawerMode(mode);
    setStoryTask(null);
    setDrawerOpen(true);
  };

  const handleCreateStory = async (payload: StoryPayload) => {
    try {
      const created = await storyLibraryApi.createStory(payload);
      setStories((current) => [created, ...current]);
      setActiveStory(created);
      setError(null);
      setDrawerOpen(false);
      showToast("故事已保存", "success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "故事保存失败");
      throw requestError;
    }
  };

  const handleGenerateStory = async (payload: StoryGeneratePayload) => {
    try {
      const response = await storyLibraryApi.generateStory(payload);
      setStoryTask(response.task);
      setActiveStory(response.story);
      setError(null);
      showToast("AI 故事已进入生成队列", "success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 故事创建失败");
      throw requestError;
    }
  };

  const handleOpenDetail = async (story: StorySummary) => {
    setActiveStory(story);
    setDetailDrawerOpen(true);
    try {
      const detail = await storyLibraryApi.getStory(story.id);
      setDetailStory(detail);
      setError(null);
    } catch (requestError) {
      setDetailDrawerOpen(false);
      setError(requestError instanceof Error ? requestError.message : "故事详情加载失败");
    }
  };

  const handleOpenEdit = async (story: StorySummary) => {
    try {
      const detail = await storyLibraryApi.getStory(story.id);
      setEditStory(detail);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "故事详情加载失败");
    }
  };

  const handleUpdateStory = async (storyId: number, payload: StoryPayload) => {
    try {
      const updated = await storyLibraryApi.updateStory(storyId, payload);
      setStories((current) => current.map((story) => (story.id === updated.id ? updated : story)));
      setActiveStory(updated);
      setDetailStory((current) => (current?.id === updated.id ? updated : current));
      setEditStory(null);
      showToast("故事已更新", "success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "故事更新失败");
      throw requestError;
    }
  };

  const handleDeleteStory = async (story: StorySummary) => {
    if (!window.confirm(`确定删除「${story.title}」吗？`)) return;
    try {
      await storyLibraryApi.deleteStory(story.id);
      setStories((current) => current.filter((item) => item.id !== story.id));
      setActiveStory((current) => (current?.id === story.id ? null : current));
      setDetailStory((current) => (current?.id === story.id ? null : current));
      setDetailDrawerOpen(false);
      showToast("故事已删除", "success");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "故事删除失败");
    }
  };

  const handleStartCreation = async (story: StorySummary) => {
    try {
      await storyLibraryApi.startCreation(story.id);
    } catch {
      // 创作模块负责后续登录和权益；故事库只发起入口。
    } finally {
      navigate("/create");
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-8 pb-12 max-sm:px-4">
        <header className="relative py-12 text-center max-sm:py-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(139,198,168,0.08),transparent_70%)]" />
          <h1 className="font-display relative text-[38px] leading-tight text-[var(--text-dark)] max-sm:text-[30px]">故事库</h1>
          <p className="relative mx-auto mt-2 max-w-[620px] text-base leading-7 text-[var(--text-mid)]">
            管理纯文本故事资产。你可以让 AI 根据灵感生成故事，也可以黏贴已有文本保存到我的故事。
          </p>
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>
              全部
              <Badge tone="honey">{stories.length}</Badge>
            </TabButton>
            <TabButton active={tab === "system"} onClick={() => setTab("system")}>
              系统故事
              <Badge tone="sky">{systemStories.length}</Badge>
            </TabButton>
            <TabButton active={tab === "user"} onClick={() => setTab("user")}>
              我的故事
              <Badge tone="sage">{userStories.length}</Badge>
            </TabButton>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={() => openCreateDrawer("ai")}>
              <Sparkles className="h-4 w-4" />
              AI 创建
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => openCreateDrawer("paste")}>
              <Plus className="h-4 w-4" />
              黏贴故事
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.18)] bg-white px-4 py-3 text-sm text-[var(--text-mid)]">
            {error}
          </div>
        ) : null}

        <section>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title={tab === "system" ? "系统故事" : tab === "user" ? "我的故事" : "全部故事"} badge={`${visibleStories.length} 篇`} />
            {activeStory ? (
              <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--text-light)] shadow-[var(--shadow-soft)]">
                当前查看：<span className="text-[var(--text-mid)]">{activeStory.title}</span>
              </div>
            ) : null}
          </div>

          {loading ? (
            <EmptyState text="正在加载故事..." />
          ) : visibleStories.length > 0 ? (
            <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {visibleStories.map((story) => (
                <StoryCard
                  key={story.id}
                  labels={taxonomyLabels}
                  story={story}
                  onDelete={story.owner_user_id !== null ? handleDeleteStory : undefined}
                  onEdit={story.owner_user_id !== null ? handleOpenEdit : undefined}
                  onOpen={handleOpenDetail}
                  onStartCreation={handleStartCreation}
                />
              ))}
            </div>
          ) : (
            <EmptyState text={tab === "user" ? "还没有我的故事，点击上方 AI 创建或黏贴故事。" : "当前筛选下暂无故事。"} />
          )}
        </section>
      </main>

      <StoryCreateDrawer
        isOpen={drawerOpen}
        mode={drawerMode}
        task={storyTask}
        onClose={() => setDrawerOpen(false)}
        onGenerate={handleGenerateStory}
        onSubmit={handleCreateStory}
      />
      <StoryDetailDrawer
        isOpen={detailDrawerOpen}
        story={detailStory}
        storyTitle={activeStory?.title ?? ""}
        onClose={() => setDetailDrawerOpen(false)}
        onDelete={detailStory && detailStory.owner_user_id !== null ? () => handleDeleteStory(detailStory) : undefined}
        onEdit={detailStory && detailStory.owner_user_id !== null ? () => setEditStory(detailStory) : undefined}
        onStartCreation={detailStory ? () => handleStartCreation(detailStory) : undefined}
        taxonomyLabels={taxonomyLabels}
      />
      <StoryEditDrawer
        story={editStory}
        onClose={() => setEditStory(null)}
        onSubmit={handleUpdateStory}
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

const Badge: React.FC<React.PropsWithChildren<{ tone: "honey" | "sage" | "sky" }>> = ({ children, tone }) => (
  <span
    className={cn(
      "rounded-full px-2 py-0.5 text-xs",
      tone === "honey" && "bg-[rgba(245,166,35,0.14)] text-[var(--honey)]",
      tone === "sage" && "bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]",
      tone === "sky" && "bg-[rgba(126,200,227,0.16)] text-[var(--sky-deep)]",
    )}
  >
    {children}
  </span>
);

const SectionTitle: React.FC<{ title: string; badge?: string }> = ({ title, badge }) => (
  <h2 className="font-display flex items-center gap-2 text-[24px] text-[var(--text-dark)]">
    {title}
    {badge ? (
      <span className="rounded-full bg-[linear-gradient(135deg,var(--honey),var(--peach))] px-2.5 py-1 text-xs font-bold text-white">
        {badge}
      </span>
    ) : null}
  </h2>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => <div className="app-card p-7 text-sm text-[var(--text-light)]">{text}</div>;

const StoryCreateDrawer: React.FC<{
  isOpen: boolean;
  mode: StoryCreateMode;
  task: GenerationTaskRead | null;
  onClose: () => void;
  onGenerate: (payload: StoryGeneratePayload) => Promise<void> | void;
  onSubmit: (payload: StoryPayload) => Promise<void> | void;
}> = ({ isOpen, mode, task, onClose, onGenerate, onSubmit }) => {
  if (!isOpen) return null;

  const taskActive = task && task.status !== "succeeded" && task.status !== "failed" && task.status !== "canceled";

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <aside
        className="flex h-full w-full max-w-[560px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-create-drawer-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="story-create-drawer-title" className="font-display text-2xl">
              {mode === "ai" ? "AI 创建故事" : "黏贴故事"}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">
              {mode === "ai" ? "生成完成后会自动保存到我的故事。" : "保存后可以从故事库发起绘本生成。"}
            </p>
          </div>
          <Button aria-label="关闭创建框" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {task ? <StoryTaskPanel task={task} /> : null}
          <div className={taskActive ? "pointer-events-none mt-4 opacity-45" : task ? "mt-4" : ""}>
            <StoryEditor mode={mode} onGenerate={onGenerate} onSubmit={onSubmit} />
          </div>
        </div>
      </aside>
    </div>
  );
};

const StoryTaskPanel: React.FC<{ task: GenerationTaskRead }> = ({ task }) => {
  const isFailed = task.status === "failed";
  const isDone = task.status === "succeeded";
  return (
    <section className="rounded-[var(--radius-md)] border border-[rgba(139,198,168,0.12)] bg-[rgba(139,198,168,0.08)] p-4">
      <div className="flex items-start gap-3">
        {!isDone && !isFailed ? <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-[var(--sage-deep)]" /> : <Sparkles className="mt-0.5 h-5 w-5 text-[var(--sage-deep)]" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[var(--text-dark)]">{isDone ? "故事已生成" : isFailed ? "生成失败" : "AI 正在写故事"}</h3>
            <span className="text-xs font-semibold text-[var(--text-light)]">{task.progress_percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--terracotta),var(--honey))]" style={{ width: `${task.progress_percent}%` }} />
          </div>
          {task.error_message ? <p className="mt-2 text-xs text-[var(--terracotta)]">{task.error_message}</p> : null}
        </div>
      </div>
    </section>
  );
};

const StoryDetailDrawer: React.FC<{
  isOpen: boolean;
  story: StoryDetail | null;
  storyTitle: string;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onStartCreation?: () => void;
  taxonomyLabels: StoryTaxonomyLabels;
}> = ({ isOpen, story, storyTitle, onClose, onDelete, onEdit, onStartCreation, taxonomyLabels }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[180] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <aside
        className="flex h-full w-full max-w-[640px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-detail-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div className="min-w-0">
            <h2 id="story-detail-title" className="font-display truncate text-2xl">
              {story?.title ?? storyTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">{story ? sourceLabel(story) : "正在加载故事详情..."}</p>
          </div>
          <Button aria-label="关闭详情" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!story ? (
            <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载故事详情...</div>
          ) : (
            <div className="grid gap-5">
              <section className="rounded-[var(--radius-md)] bg-[rgba(212,114,92,0.06)] p-4">
                <p className="text-sm leading-6 text-[var(--text-mid)]">{story.summary ?? "暂无简介"}</p>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm max-sm:grid-cols-1">
                  <Info label="来源" value={sourceLabel(story)} />
                  <Info label="语言" value={languageLabel(story.language)} />
                  <Info label="权益" value={accessLevelLabel(story.access_level)} />
                  <Info label="状态" value={publishStatusLabel(story.publish_status)} />
                  <Info label="浏览" value={`${story.view_count}`} />
                </dl>
                <div className="mt-4 grid gap-3">
                  <MetaTags label="适龄范围" values={labelCodes(story.age_range_codes, taxonomyLabels.ageRange)} />
                  <MetaTags label="主题方向" values={labelCodes(story.theme_codes, taxonomyLabels.theme)} />
                  <MetaTags label="教育目标" values={labelCodes(story.education_goal_codes, taxonomyLabels.educationGoal)} />
                  <MetaTags label="叙事风格" values={story.narrative_style_code ? [taxonomyLabels.narrativeStyle[story.narrative_style_code] ?? story.narrative_style_code] : []} />
                </div>
              </section>
              <section>
                <h3 className="mb-3 text-sm font-bold text-[var(--text-dark)]">故事正文</h3>
                <div className="whitespace-pre-wrap rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[var(--cream)] p-4 text-sm leading-7 text-[var(--text-mid)]">
                  {story.body}
                </div>
              </section>
            </div>
          )}
        </div>
        {story ? (
          <div className="flex flex-wrap gap-2 border-t border-[rgba(212,114,92,0.08)] p-5">
            {onEdit ? (
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                编辑
              </Button>
            ) : null}
            {onDelete ? (
              <Button type="button" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            ) : null}
            <Button type="button" onClick={onStartCreation}>
              <BookOpenText className="h-4 w-4" />
              生成绘本
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
};

const StoryEditDrawer: React.FC<{
  story: StoryDetail | null;
  onClose: () => void;
  onSubmit: (storyId: number, payload: StoryPayload) => Promise<void> | void;
}> = ({ story, onClose, onSubmit }) => {
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  useEffect(() => {
    if (!story) return;
    setTitle(story.title);
    setSummary(story.summary ?? "");
    setBody(story.body);
  }, [story]);

  if (!story) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(story.id, {
        title,
        summary: summary || null,
        body,
        source_type: story.source_type,
        age_range_codes: story.age_range_codes,
        theme_codes: story.theme_codes,
        education_goal_codes: story.education_goal_codes,
        language: story.language,
        narrative_style_code: story.narrative_style_code ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[190] flex justify-end bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm max-md:justify-center">
      <form
        className="flex h-full w-full max-w-[560px] flex-col rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white shadow-[var(--shadow-hover)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-edit-title"
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] p-5">
          <div>
            <h2 id="story-edit-title" className="font-display text-2xl">
              编辑故事
            </h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">调整故事标题、简介和正文。</p>
          </div>
          <Button aria-label="关闭编辑" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5">
          <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
            故事标题
            <input className="h-[46px] rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] px-3.5 text-sm outline-none focus:border-[var(--peach)]" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
            一句话简介
            <input className="h-[46px] rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] px-3.5 text-sm outline-none focus:border-[var(--peach)]" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={1000} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
            故事正文
            <textarea className="min-h-[300px] rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] px-3.5 py-3 text-sm leading-6 outline-none focus:border-[var(--peach)]" value={body} onChange={(event) => setBody(event.target.value)} maxLength={3000} required />
          </label>
        </div>
        <div className="border-t border-[rgba(212,114,92,0.08)] p-5">
          <Button className="w-full" disabled={submitting || !title || !body} type="submit">
            {submitting ? "保存中..." : "保存修改"}
          </Button>
        </div>
      </form>
    </div>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-white px-3 py-2">
    <dt className="text-xs text-[var(--text-light)]">{label}</dt>
    <dd className="font-semibold text-[var(--text-mid)]">{value}</dd>
  </div>
);

const MetaTags: React.FC<{ label: string; values: string[] }> = ({ label, values }) => (
  <div>
    <p className="mb-1.5 text-xs font-bold text-[var(--text-light)]">{label}</p>
    {values.length ? (
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span key={value} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--text-mid)]">
            {value}
          </span>
        ))}
      </div>
    ) : (
      <span className="text-xs text-[var(--text-light)]">未设置</span>
    )}
  </div>
);

interface StoryTaxonomyLabels {
  ageRange: Record<string, string>;
  theme: Record<string, string>;
  educationGoal: Record<string, string>;
  narrativeStyle: Record<string, string>;
}

const labelCodes = (codes: string[], labels: Record<string, string>) => codes.map((code) => labels[code] ?? code);

const sourceLabel = (story: StorySummary) => {
  if (story.source_type === "system") return "系统故事";
  if (story.source_type === "generated_idea") return "AI 生成";
  return "我的故事";
};

const languageLabel = (language: StorySummary["language"]) => {
  if (language === "bilingual") return "中英双语";
  if (language === "en") return "英文";
  return "中文";
};

const accessLevelLabel = (accessLevel: StorySummary["access_level"]) => {
  if (accessLevel === "vip") return "会员";
  if (accessLevel === "preview") return "预览";
  return "免费";
};

const publishStatusLabel = (status: StorySummary["publish_status"]) => {
  if (status === "draft") return "草稿";
  if (status === "unpublished") return "未发布";
  if (status === "deleted") return "已删除";
  return "已发布";
};
