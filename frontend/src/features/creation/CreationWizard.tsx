import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Image, Mic2, Palette, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GenerationTaskStatus } from "@/entities/generation-task";
import { TemplateLockedNotice, TemplateSelector, templateApi, type TemplateSummary } from "@/entities/template";

import { creationApi } from "./api";
import type { ArtStyleRef, CharacterRef, CreationSession, CreationStorySourceType, GenerationTaskRead, VoiceRef } from "./types";

type WizardPath = "story" | "template";
type WizardStep = "source" | "character" | "style" | "storyboard" | "voice" | "preview";

const storySources: Array<{ value: CreationStorySourceType; title: string; desc: string }> = [
  { value: "system_story", title: "系统故事", desc: "使用平台精选故事作为蓝本" },
  { value: "user_story", title: "我的故事", desc: "从个人故事库选择已有故事" },
  { value: "uploaded_story", title: "上传/粘贴", desc: "粘贴 3000 字以内故事文本" },
  { value: "idea", title: "一个想法", desc: "先生成可确认的故事内容" },
];

const steps: Array<{ value: WizardStep; label: string }> = [
  { value: "source", label: "故事/模板" },
  { value: "character", label: "形象" },
  { value: "style", label: "画风" },
  { value: "storyboard", label: "分镜" },
  { value: "voice", label: "声音" },
  { value: "preview", label: "预览" },
];

export const CreationWizard: React.FC = () => {
  const [path, setPath] = useState<WizardPath>("story");
  const [step, setStep] = useState<WizardStep>("source");
  const [storySource, setStorySource] = useState<CreationStorySourceType>("system_story");
  const [language, setLanguage] = useState<"zh" | "en" | "bilingual">("zh");
  const [pageCount, setPageCount] = useState(8);
  const [ideaPrompt, setIdeaPrompt] = useState("一只小熊在夜晚寻找月亮，最后学会勇敢和等待。");
  const [session, setSession] = useState<CreationSession | null>(null);
  const [task, setTask] = useState<GenerationTaskRead | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    templateApi
      .listTemplates()
      .then((response) => setTemplates(response.items))
      .catch(() => setTemplates([]));
  }, []);

  const activeStepIndex = steps.findIndex((item) => item.value === step);
  const canUseTemplate = path === "template" && selectedTemplate !== null;

  const previewItems = useMemo(
    () => [
      ["路径", path === "story" ? "基于故事生成" : "基于模板创作"],
      ["来源", path === "story" ? sourceLabel(storySource) : selectedTemplate?.title ?? "待选择"],
      ["页数", `${pageCount} 页`],
      ["语言", language === "bilingual" ? "中英双语" : language === "en" ? "英文" : "中文"],
      ["形象", session?.character_refs?.length ? `${session.character_refs.length} 个角色` : "待确认"],
      ["声音", session?.voice_ref ? String(session.voice_ref.display_name ?? "已选择") : "待选择"],
    ],
    [language, pageCount, path, selectedTemplate?.title, session?.character_refs, session?.voice_ref, storySource],
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
    const created = await creationApi.createSession({
      creation_type: path === "template" ? "template_book" : "story_to_book",
      story_source_type: path === "story" ? storySource : null,
      template_id: path === "template" ? selectedTemplate?.id ?? null : null,
      language,
      target_page_count: pageCount,
      age_range_codes: ["age_5_6"],
      theme_codes: ["adventure"],
      education_goal_codes: ["courage"],
      narrative_style_code: "bedtime",
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
      const current = await ensureSession();
      if (path === "story" && storySource === "idea") {
        const response = await creationApi.generateStory(current.id, ideaPrompt);
        setSession(response.session);
        setTask(response.task);
      }
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
            <PathButton active={path === "story"} onClick={() => setPath("story")} icon={<BookOpen className="h-4 w-4" />} label="故事生成" />
            <PathButton active={path === "template"} onClick={() => setPath("template")} icon={<Sparkles className="h-4 w-4" />} label="模板创作" />
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
              <StorySourcePanel
                storySource={storySource}
                setStorySource={setStorySource}
                language={language}
                setLanguage={setLanguage}
                pageCount={pageCount}
                setPageCount={setPageCount}
                ideaPrompt={ideaPrompt}
                setIdeaPrompt={setIdeaPrompt}
              />
            ) : (
              <div className="space-y-4">
                <TemplateLockedNotice />
                <TemplateSelector templates={templates} selectedId={selectedTemplate?.id ?? null} onSelect={setSelectedTemplate} />
              </div>
            )
          ) : null}

          {step === "character" ? (
            <StepPanel icon={<UserRound className="h-5 w-5" />} title={path === "template" ? "替换模板角色" : "选择故事形象"} desc={path === "template" ? "为必填角色选择头像或保留默认，普通画风和分镜编辑保持关闭。" : "选择故事原形象、系统形象或个人形象来参与生成。"}>
              <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                {["故事主角", "小星星", "系统伙伴"].map((name) => (
                  <SelectableTile key={name} selected={name === "小星星"} title={name} desc={name === "小星星" ? "儿童档案默认形象" : "可用于本次创作"} />
                ))}
              </div>
            </StepPanel>
          ) : null}

          {step === "style" ? (
            <StepPanel icon={<Palette className="h-5 w-5" />} title="确定画风" desc="基于故事生成可以选择系统画风或自定义画风；模板路径不会进入这一步。">
              <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
                {["水彩画风", "蜡笔画风", "卡通画风", "睡前温柔", "国风", "手绘线稿"].map((name) => (
                  <SelectableTile key={name} selected={name === "水彩画风"} title={name} desc={name === "水彩画风" ? "柔和、温暖，适合 6-12 页绘本" : "可由运营配置权益状态"} />
                ))}
              </div>
            </StepPanel>
          ) : null}

          {step === "storyboard" ? (
            <StepPanel icon={<Image className="h-5 w-5" />} title="编辑分镜" desc="分镜包含每页标题、正文、画面描述、出场形象和对白标记。">
              <div className="space-y-3">
                {(session?.storyboard_pages ?? []).map((page) => (
                  <div key={page.id} className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-[var(--warm-bg)] p-4">
                    <div className="flex justify-between gap-3">
                      <h3 className="font-bold">第 {page.page_no} 页 · {page.title}</h3>
                      <span className="text-xs font-semibold text-[var(--sage-deep)]">{page.generation_status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-mid)]">{page.text_zh}</p>
                    <p className="mt-2 text-xs text-[var(--text-light)]">{page.visual_prompt}</p>
                  </div>
                ))}
              </div>
            </StepPanel>
          ) : null}

          {step === "voice" ? (
            <StepPanel icon={<Mic2 className="h-5 w-5" />} title="选择朗读声音" desc={path === "template" ? "可使用模板默认声音；替换声音时不改变正文、对白和播放节奏。" : "系统声音和个人声音都可作为整本生成声音。"}>
              <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                {["温柔姐姐", "活泼哥哥", path === "template" ? "模板默认声音" : "妈妈的声音"].map((name) => (
                  <SelectableTile key={name} selected={name.includes("温柔") || name.includes("模板")} title={name} desc="中文 · 可试听 · 可使用" />
                ))}
              </div>
            </StepPanel>
          ) : null}

          {step === "preview" ? (
            <StepPanel icon={<Check className="h-5 w-5" />} title="播放预览" desc="确认图片、文字、音频与对白后保存到个人绘本库。">
              <div className="rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#ffe0b2,#b3e5fc)] p-8 text-center text-6xl shadow-inner">📖</div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm max-sm:grid-cols-1">
                {previewItems.map(([label, value]) => (
                  <div key={label} className="rounded-[var(--radius-sm)] bg-[var(--warm-bg)] px-3 py-2">
                    <div className="text-xs text-[var(--text-light)]">{label}</div>
                    <div className="font-semibold text-[var(--text-mid)]">{value}</div>
                  </div>
                ))}
              </div>
            </StepPanel>
          ) : null}

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

      <aside className="space-y-5">
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
      </aside>
    </main>
  );
};

const StorySourcePanel: React.FC<{
  storySource: CreationStorySourceType;
  setStorySource: (value: CreationStorySourceType) => void;
  language: "zh" | "en" | "bilingual";
  setLanguage: (value: "zh" | "en" | "bilingual") => void;
  pageCount: number;
  setPageCount: (value: number) => void;
  ideaPrompt: string;
  setIdeaPrompt: (value: string) => void;
}> = ({ storySource, setStorySource, language, setLanguage, pageCount, setPageCount, ideaPrompt, setIdeaPrompt }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      {storySources.map((source) => (
        <SelectableTile key={source.value} selected={storySource === source.value} title={source.title} desc={source.desc} onClick={() => setStorySource(source.value)} />
      ))}
    </div>
    {storySource === "idea" ? (
      <textarea className="min-h-28 w-full rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.14)] bg-white p-4 text-sm outline-none focus:border-[var(--terracotta)]" value={ideaPrompt} onChange={(event) => setIdeaPrompt(event.target.value)} />
    ) : null}
    <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
      <label className="text-sm font-semibold text-[var(--text-mid)]">
        故事长度
        <select className="mt-1 w-full rounded-lg border border-[rgba(212,114,92,0.14)] bg-white px-3 py-2" value={pageCount} onChange={(event) => setPageCount(Number(event.target.value))}>
          <option value={6}>短篇 6 页</option>
          <option value={8}>中篇 8 页</option>
          <option value={12}>长篇 12 页</option>
        </select>
      </label>
      <label className="text-sm font-semibold text-[var(--text-mid)]">
        语言
        <select className="mt-1 w-full rounded-lg border border-[rgba(212,114,92,0.14)] bg-white px-3 py-2" value={language} onChange={(event) => setLanguage(event.target.value as "zh" | "en" | "bilingual")}>
          <option value="zh">中文</option>
          <option value="en">English</option>
          <option value="bilingual">中英双语</option>
        </select>
      </label>
      <div className="rounded-[var(--radius-md)] bg-[rgba(139,198,168,0.14)] p-3 text-sm text-[var(--text-mid)]">MVP 单本限定 6-12 页。</div>
    </div>
  </div>
);

const PathButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button type="button" className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-[var(--terracotta)] text-white" : "text-[var(--text-mid)]"}`} onClick={onClick}>
    {icon}
    {label}
  </button>
);

const StepPanel: React.FC<React.PropsWithChildren<{ icon: React.ReactNode; title: string; desc: string }>> = ({ icon, title, desc, children }) => (
  <div>
    <div className="mb-4 flex items-start gap-3">
      <div className="rounded-[var(--radius-sm)] bg-[rgba(212,114,92,0.1)] p-2 text-[var(--terracotta)]">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-[var(--text-dark)]">{title}</h2>
        <p className="text-sm text-[var(--text-light)]">{desc}</p>
      </div>
    </div>
    {children}
  </div>
);

const SelectableTile: React.FC<{ selected: boolean; title: string; desc: string; onClick?: () => void }> = ({ selected, title, desc, onClick }) => (
  <button type="button" className={`rounded-[var(--radius-md)] border bg-white p-4 text-left transition hover:-translate-y-0.5 ${selected ? "border-[var(--terracotta)] shadow-[var(--shadow-hover)]" : "border-[rgba(212,114,92,0.1)] shadow-[var(--shadow-soft)]"}`} onClick={onClick}>
    <div className="font-bold text-[var(--text-dark)]">{title}</div>
    <div className="mt-1 text-xs text-[var(--text-light)]">{desc}</div>
  </button>
);

const sourceLabel = (value: CreationStorySourceType) => storySources.find((source) => source.value === value)?.title ?? value;
