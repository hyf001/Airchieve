import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GenerationTaskStatus } from "@/entities/generation-task";
import { type StoryDetail, type StorySummary } from "@/entities/story";
import { templateApi, type TemplateSummary } from "@/entities/template";
import { useTaxonomyGroup } from "@/entities/taxonomy";
import { storyLibraryApi } from "@/features/story-library";

import { creationApi } from "./api";
import { PathButton } from "./components";
import { SelectedStoryBodyPanel } from "./SelectedStoryBodyPanel";
import { CharacterStep } from "./steps/CharacterStep";
import { PreviewStep } from "./steps/PreviewStep";
import { StoryboardStep } from "./steps/StoryboardStep";
import { StorySourceStep } from "./steps/StorySourceStep";
import { StyleStep } from "./steps/StyleStep";
import { TemplateSourceStep } from "./steps/TemplateSourceStep";
import { VoiceStep } from "./steps/VoiceStep";
import { sourceLabel, steps, type WizardPath, type WizardStep } from "./constants";
import type { ArtStyleRef, CharacterRef, CreationSession, CreationStorySourceType, GenerationTaskRead, VoiceRef } from "./types";

export const CreationWizard: React.FC = () => {
  const [path, setPath] = useState<WizardPath>("story");
  const [step, setStep] = useState<WizardStep>("source");
  const [storySource, setStorySource] = useState<CreationStorySourceType>("system_story");
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<StorySummary | null>(null);
  const [selectedStoryDetail, setSelectedStoryDetail] = useState<StoryDetail | null>(null);
  const [storyQuery, setStoryQuery] = useState("");
  const [ageFilter, setAgeFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [storyPage, setStoryPage] = useState(1);
  const [session, setSession] = useState<CreationSession | null>(null);
  const [task, setTask] = useState<GenerationTaskRead | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ageRanges = useTaxonomyGroup("age_range");
  const themes = useTaxonomyGroup("theme");
  const educationGoals = useTaxonomyGroup("education_goal");

  useEffect(() => {
    templateApi
      .listTemplates()
      .then((response) => setTemplates(response.items))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    storyLibraryApi
      .listStories()
      .then((response) => setStories(response.items))
      .catch(() => setStories([]))
      .finally(() => setStoriesLoading(false));
  }, []);

  const storyLabels = useMemo(
    () => ({
      ageRange: ageRanges.labelMap,
      theme: themes.labelMap,
      educationGoal: educationGoals.labelMap,
    }),
    [ageRanges.labelMap, educationGoals.labelMap, themes.labelMap],
  );

  const visibleStories = useMemo(() => {
    const query = storyQuery.trim().toLowerCase();
    return stories.filter((story) => {
      const sourceMatched = storySource === "system_story" ? story.source_type === "system" : story.source_type !== "system";
      if (!sourceMatched) return false;
      if (ageFilter && !story.age_range_codes.includes(ageFilter)) return false;
      if (themeFilter && !story.theme_codes.includes(themeFilter)) return false;
      if (!query) return true;
      return `${story.title} ${story.summary ?? ""}`.toLowerCase().includes(query);
    });
  }, [ageFilter, stories, storyQuery, storySource, themeFilter]);

  const pageSize = 4;
  const totalStoryPages = Math.max(1, Math.ceil(visibleStories.length / pageSize));
  const pagedStories = useMemo(
    () => visibleStories.slice((storyPage - 1) * pageSize, storyPage * pageSize),
    [storyPage, visibleStories],
  );

  const resetCreationProgress = () => {
    setSession(null);
    setTask(null);
    setStep("source");
    setMessage(null);
  };

  useEffect(() => {
    if (path !== "story") return;
    setSelectedStory((current) => (current && visibleStories.some((story) => story.id === current.id) ? current : visibleStories[0] ?? null));
  }, [path, visibleStories]);

  useEffect(() => {
    setStoryPage(1);
  }, [ageFilter, storyQuery, storySource, themeFilter]);

  useEffect(() => {
    setStoryPage((current) => Math.min(current, totalStoryPages));
  }, [totalStoryPages]);

  useEffect(() => {
    if (!selectedStory) {
      setSelectedStoryDetail(null);
      return;
    }
    let cancelled = false;
    storyLibraryApi
      .getStory(selectedStory.id)
      .then((detail) => {
        if (!cancelled) setSelectedStoryDetail(detail);
      })
      .catch(() => {
        if (!cancelled) setSelectedStoryDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStory]);

  const activeStepIndex = steps.findIndex((item) => item.value === step);
  const canUseTemplate = path === "template" && selectedTemplate !== null;
  const language = selectedStory?.language ?? "zh";
  const pageCount = 8;

  const previewItems = useMemo(
    () => [
      ["路径", path === "story" ? "基于故事生成" : "基于模板创作"],
      ["来源", path === "story" ? sourceLabel(storySource) : selectedTemplate?.title ?? "待选择"],
      ["故事", path === "story" ? selectedStory?.title ?? "待选择" : selectedTemplate?.title ?? "待选择"],
      ["页数", `${pageCount} 页`],
      ["语言", language === "bilingual" ? "中英双语" : language === "en" ? "英文" : "中文"],
      ["形象", session?.character_refs?.length ? `${session.character_refs.length} 个角色` : "待确认"],
      ["声音", session?.voice_ref ? String(session.voice_ref.display_name ?? "已选择") : "待选择"],
    ],
    [language, pageCount, path, selectedStory?.title, selectedTemplate?.title, session?.character_refs, session?.voice_ref, storySource],
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const ensureSession = async () => {
    if (session) return session;
    if (path === "story" && !selectedStory) {
      throw new Error("请先选择一个故事");
    }
    const created = await creationApi.createSession({
      creation_type: path === "template" ? "template_book" : "story_to_book",
      story_source_type: path === "story" ? storySource : null,
      story_id: path === "story" ? selectedStory?.id ?? null : null,
      template_id: path === "template" ? selectedTemplate?.id ?? null : null,
      language,
      target_page_count: pageCount,
      age_range_codes: path === "story" ? selectedStory?.age_range_codes ?? [] : ["age_5_6"],
      theme_codes: path === "story" ? selectedStory?.theme_codes ?? [] : ["adventure"],
      education_goal_codes: path === "story" ? selectedStory?.education_goal_codes ?? [] : ["courage"],
      narrative_style_code: path === "story" ? selectedStory?.narrative_style_code ?? null : "bedtime",
    });
    setSession(created);
    return created;
  };

  const handleContinueFromSource = () =>
    run(async () => {
      if (path === "template" && !canUseTemplate) {
        setMessage("请先选择一个绘本模板");
        return;
      }
      if (path === "story" && !selectedStory) {
        setMessage("请先选择一个故事");
        return;
      }
      await ensureSession();
      setStep(path === "template" ? "character" : "character");
    });

  const handleConfirmCharacters = () =>
    run(async () => {
      const current = await ensureSession();
      const characterRefs: CharacterRef[] =
        path === "template"
          ? [{ source: "child_profile_default", role_code: "hero", display_name: "小星星" }]
          : [
              { source: "story_original", role_code: "hero", display_name: "故事主角" },
              { source: "system_character", role_code: "friend", display_name: "系统伙伴" },
            ];
      const updated = await creationApi.updateConfig(current.id, { character_refs: characterRefs });
      setSession(updated);
      setStep(path === "template" ? "voice" : "style");
    });

  const handleConfirmStyle = () =>
    run(async () => {
      const current = await ensureSession();
      const artStyleRef: ArtStyleRef = { source: "system", art_style_code: "watercolor" };
      const updated = await creationApi.updateConfig(current.id, { art_style_ref: artStyleRef });
      setSession(updated);
      const response = await creationApi.generateStoryboard(current.id);
      setSession(response.session);
      setTask(response.task);
      setStep("storyboard");
    });

  const handleGenerateImages = () =>
    run(async () => {
      if (!session) return;
      const response = await creationApi.generateImages(session.id);
      setSession(response.session);
      setTask(response.task);
      setStep("voice");
    });

  const handleConfirmVoice = () =>
    run(async () => {
      const current = await ensureSession();
      const voiceRef: VoiceRef = path === "template" ? { source: "template_default", display_name: "模板默认声音" } : { source: "system", display_name: "温柔姐姐" };
      const updated = await creationApi.updateConfig(current.id, { voice_ref: voiceRef });
      setSession(updated);
      const response = await creationApi.generateAudio(current.id);
      setSession(response.session);
      setTask(response.task);
      setStep("preview");
    });

  const handleSave = () =>
    run(async () => {
      if (!session) return;
      const response = await creationApi.saveBook(session.id);
      setSession(response.session);
      setMessage(`已保存到我的绘本库：${response.book.title}`);
    });

  return (
    <main className="mx-auto grid max-w-[1320px] grid-cols-[1fr_340px] gap-6 px-8 py-8 max-lg:grid-cols-1 max-sm:px-4">
      <section className="min-w-0">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">创作绘本</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">从故事生成完整绘本，或用模板替换角色头像和朗读声音。</p>
          </div>
          <div className="flex rounded-[var(--radius-sm)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <PathButton active={path === "story"} onClick={() => { setPath("story"); resetCreationProgress(); }} icon={<BookOpen className="h-4 w-4" />} label="故事生成" />
            <PathButton active={path === "template"} onClick={() => { setPath("template"); resetCreationProgress(); }} icon={<Sparkles className="h-4 w-4" />} label="模板创作" />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-6 gap-2 max-md:grid-cols-3">
          {steps.map((item, index) => (
            <div key={item.value} className={`rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold ${index <= activeStepIndex ? "bg-[var(--terracotta)] text-white" : "bg-white text-[var(--text-light)]"}`}>
              {index + 1}. {item.label}
            </div>
          ))}
        </div>

        {message ? <div className="mb-4 rounded-[var(--radius-md)] bg-white px-4 py-3 text-sm text-[var(--terracotta)] shadow-[var(--shadow-soft)]">{message}</div> : null}
        <GenerationTaskStatus task={task} onRetry={(failedTask) => run(async () => setTask(await creationApi.retryTask(failedTask.id)))} />

        <section className="app-card mt-5 p-6">
          {step === "source" ? (
            path === "story" ? (
              <StorySourceStep
                storySource={storySource}
                setStorySource={(value) => {
                  setStorySource(value);
                  resetCreationProgress();
                }}
                ageFilter={ageFilter}
                ageRangeOptions={ageRanges.items}
                labels={storyLabels}
                page={storyPage}
                stories={pagedStories}
                storiesLoading={storiesLoading}
                storyQuery={storyQuery}
                selectedStoryId={selectedStory?.id ?? null}
                themeFilter={themeFilter}
                themeOptions={themes.items}
                total={visibleStories.length}
                totalPages={totalStoryPages}
                onAgeFilterChange={setAgeFilter}
                onPageChange={setStoryPage}
                onSelectStory={(story) => {
                  setSelectedStory(story);
                  resetCreationProgress();
                }}
                onStoryQueryChange={setStoryQuery}
                onThemeFilterChange={setThemeFilter}
              />
            ) : (
              <TemplateSourceStep templates={templates} selectedTemplateId={selectedTemplate?.id ?? null} onSelectTemplate={setSelectedTemplate} />
            )
          ) : null}

          {step === "character" ? <CharacterStep path={path} /> : null}
          {step === "style" ? <StyleStep /> : null}
          {step === "storyboard" ? <StoryboardStep session={session} /> : null}
          {step === "voice" ? <VoiceStep path={path} /> : null}
          {step === "preview" ? <PreviewStep previewItems={previewItems} /> : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button type="button" variant="ghost" disabled={step === "source" || busy} onClick={() => setStep(steps[Math.max(0, activeStepIndex - 1)].value)}>
              上一步
            </Button>
            {step === "source" ? <Button disabled={busy} onClick={handleContinueFromSource}>下一步：选择形象</Button> : null}
            {step === "character" ? <Button disabled={busy} onClick={handleConfirmCharacters}>{path === "template" ? "下一步：选择声音" : "下一步：确定画风"}</Button> : null}
            {step === "style" ? <Button disabled={busy} onClick={handleConfirmStyle}>生成分镜</Button> : null}
            {step === "storyboard" ? <Button disabled={busy} onClick={handleGenerateImages}>生成全部插图</Button> : null}
            {step === "voice" ? <Button disabled={busy} onClick={handleConfirmVoice}>生成语音</Button> : null}
            {step === "preview" ? <Button disabled={busy || !session} onClick={handleSave}>保存到我的绘本库</Button> : null}
          </div>
        </section>
      </section>

      <aside className="sticky top-8 space-y-5 self-start">
        {step === "source" && path === "story" ? (
          <SelectedStoryBodyPanel story={selectedStory} storyDetail={selectedStoryDetail} />
        ) : (
          <>
            <section className="app-card p-5">
              <h2 className="font-display text-2xl">生成配置</h2>
              <dl className="mt-4 space-y-3">
                {previewItems.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-b border-[rgba(212,114,92,0.08)] pb-2 text-sm">
                    <dt className="text-[var(--text-light)]">{label}</dt>
                    <dd className="text-right font-semibold text-[var(--text-mid)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="app-card p-5 text-sm text-[var(--text-mid)]">
              <h2 className="font-display mb-2 text-2xl">边界提示</h2>
              <p>故事路径支持画风、分镜和局部重生成；模板路径只替换角色区域和朗读声音。</p>
            </section>
          </>
        )}
      </aside>
    </main>
  );
};
