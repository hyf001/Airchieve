import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GenerationTaskStatus } from "@/entities/generation-task";
import type { ArtStyle, CharacterSummary, VoiceSummary } from "@/entities/asset";
import { type StoryDetail, type StorySummary } from "@/entities/story";
import { templateApi, type TemplateSummary } from "@/entities/template";
import { useTaxonomyGroup } from "@/entities/taxonomy";
import { artStyleLibraryApi } from "@/features/art-style-library";
import { characterLibraryApi } from "@/features/character-library";
import { storyLibraryApi } from "@/features/story-library";
import { voiceLibraryApi } from "@/features/voice-library";

import { creationApi } from "./api";
import { PathButton } from "./components";
import { SelectedStoryBodyPanel } from "./SelectedStoryBodyPanel";
import { CharacterStep, roleCodeFor } from "./steps/CharacterStep";
import { LipSyncStep } from "./steps/LipSyncStep";
import { PreviewStep } from "./steps/PreviewStep";
import { StoryboardStep } from "./steps/StoryboardStep";
import { StorySourceStep } from "./steps/StorySourceStep";
import { StyleStep } from "./steps/StyleStep";
import { TemplateSourceStep } from "./steps/TemplateSourceStep";
import { VoiceStep, type VoiceRoleOption } from "./steps/VoiceStep";
import { sourceLabel, storySteps, templateSteps, type WizardPath, type WizardStep } from "./constants";
import type { ArtStyleRef, CharacterRef, CreationSession, CreationStep, CreationStorySourceType, GenerationTaskRead, VoiceRef } from "./types";

const wizardStepByCreationStep: Record<CreationStep, WizardStep> = {
  story: "source",
  template: "source",
  art_style: "style",
  character: "character",
  storyboard: "storyboard",
  voice: "voice",
  lip_sync: "lipSync",
  preview: "preview",
};

const findArtStyleForSession = (session: CreationSession | null, artStyles: ArtStyle[]) => {
  const ref = session?.art_style_ref;
  if (!ref) return null;
  const refId = typeof ref.art_style_id === "number" ? ref.art_style_id : null;
  const refCode = typeof ref.art_style_code === "string" ? ref.art_style_code : null;
  return artStyles.find((style) => (refId !== null && style.id === refId) || (!!refCode && style.code === refCode)) ?? null;
};

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
  const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
  const [artStylesLoading, setArtStylesLoading] = useState(true);
  const [selectedArtStyle, setSelectedArtStyle] = useState<ArtStyle | null>(null);
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [selectedCharactersByRole, setSelectedCharactersByRole] = useState<Record<string, CharacterSummary | null>>({});
  const [selectedStoryRoleCode, setSelectedStoryRoleCode] = useState<string | null>(null);
  const [characterQuery, setCharacterQuery] = useState("");
  const [characterSourceFilter, setCharacterSourceFilter] = useState<"all" | "system" | "custom">("all");
  const [characterPage, setCharacterPage] = useState(1);
  const [voices, setVoices] = useState<VoiceSummary[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [selectedVoicesByRole, setSelectedVoicesByRole] = useState<Record<string, VoiceSummary | null>>({});
  const [session, setSession] = useState<CreationSession | null>(null);
  const [task, setTask] = useState<GenerationTaskRead | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [targetPageCount, setTargetPageCount] = useState(8);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ageRanges = useTaxonomyGroup("age_range");
  const themes = useTaxonomyGroup("theme");
  const educationGoals = useTaxonomyGroup("education_goal");

  useEffect(() => {
    const sessionId = Number(new URLSearchParams(window.location.search).get("sessionId"));
    if (!Number.isFinite(sessionId) || sessionId <= 0) return;

    let cancelled = false;
    setBusy(true);
    setMessage(null);
    creationApi
      .getSession(sessionId)
      .then((loadedSession) => {
        if (cancelled) return;
        setSession(loadedSession);
        setPath(loadedSession.creation_type === "template_book" ? "template" : "story");
        setStorySource(loadedSession.story_source_type ?? "system_story");
        setStep(wizardStepByCreationStep[loadedSession.current_step] ?? "source");
        setMessage("已恢复创作记录，可以继续编辑或生成。");
      })
      .catch(() => {
        if (!cancelled) setMessage("创作记录加载失败，请稍后重试。");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    characterLibraryApi
      .list()
      .then((response) => setCharacters(response.items))
      .catch(() => setCharacters([]))
      .finally(() => setCharactersLoading(false));
  }, []);

  useEffect(() => {
    artStyleLibraryApi
      .list()
      .then((response) => setArtStyles(response.items))
      .catch(() => setArtStyles([]))
      .finally(() => setArtStylesLoading(false));
  }, []);

  useEffect(() => {
    voiceLibraryApi
      .list()
      .then((response) => {
        setVoices(response.items);
        const defaultVoice = response.items.find((voice) => voice.is_default) ?? response.items[0] ?? null;
        setSelectedVoicesByRole((current) => (current.narration !== undefined ? current : { ...current, narration: defaultVoice }));
      })
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
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

  const visibleCharacters = useMemo(() => {
    const query = characterQuery.trim().toLowerCase();
    return characters.filter((character) => {
      const styleMatched = selectedArtStyle
        ? character.art_style_id === selectedArtStyle.id || (!!selectedArtStyle.code && character.art_style_code === selectedArtStyle.code)
        : path === "template";
      if (!styleMatched) return false;
      const sourceMatched =
        characterSourceFilter === "all" ||
        (characterSourceFilter === "system" && character.owner_user_id === null) ||
        (characterSourceFilter === "custom" && character.owner_user_id !== null);
      if (!sourceMatched) return false;
      if (character.status !== "active") return false;
      if (character.moderation_status === "rejected" || character.moderation_status === "hidden") return false;
      if (!query) return true;
      return `${character.name} ${character.identity_tag ?? ""} ${character.description ?? ""} ${character.custom_art_style_prompt ?? ""}`.toLowerCase().includes(query);
    });
  }, [characterQuery, characterSourceFilter, characters, path, selectedArtStyle]);

  const totalCharacterPages = Math.max(1, Math.ceil(visibleCharacters.length / pageSize));
  const pagedCharacters = useMemo(
    () => visibleCharacters.slice((characterPage - 1) * pageSize, characterPage * pageSize),
    [characterPage, visibleCharacters],
  );

  const resetCreationProgress = () => {
    setSession(null);
    setTask(null);
    setStep("source");
    setMessage(null);
    setSelectedCharactersByRole({});
  };

  useEffect(() => {
    if (path !== "story") return;
    if (session?.story_id) return;
    setSelectedStory((current) => (current && visibleStories.some((story) => story.id === current.id) ? current : visibleStories[0] ?? null));
  }, [path, session?.story_id, visibleStories]);

  useEffect(() => {
    if (!session || path !== "story" || !session.story_id) return;
    const matchedStory = stories.find((story) => story.id === session.story_id);
    if (matchedStory) setSelectedStory(matchedStory);
  }, [path, session, stories]);

  useEffect(() => {
    if (!session || path !== "template" || !session.template_id) return;
    const matchedTemplate = templates.find((template) => template.id === session.template_id);
    if (matchedTemplate) setSelectedTemplate(matchedTemplate);
  }, [path, session, templates]);

  useEffect(() => {
    if (!session) return;
    setTargetPageCount(session.target_page_count);
  }, [session]);

  useEffect(() => {
    if (path !== "story") return;
    const matchedStyle = findArtStyleForSession(session, artStyles);
    if (!matchedStyle) return;
    setSelectedArtStyle((current) => (current?.id === matchedStyle.id ? current : matchedStyle));
  }, [artStyles, path, session]);

  useEffect(() => {
    const ref = session?.voice_ref;
    if (!ref || voices.length === 0) return;
    const nextSelections: Record<string, VoiceSummary | null> = {};
    const applyRef = (rawRef: Record<string, unknown>) => {
      const roleCode = typeof rawRef.role_code === "string" && rawRef.role_code ? rawRef.role_code : "narration";
      const voiceId = typeof rawRef.voice_id === "number" ? rawRef.voice_id : null;
      nextSelections[roleCode] = voiceId === null ? null : voices.find((voice) => voice.id === voiceId) ?? null;
    };
    applyRef(ref);
    const roleVoiceRefs = Array.isArray(ref.role_voice_refs) ? ref.role_voice_refs : [];
    roleVoiceRefs.forEach((roleRef) => {
      if (roleRef && typeof roleRef === "object") applyRef(roleRef as Record<string, unknown>);
    });
    setSelectedVoicesByRole((current) => ({ ...current, ...nextSelections }));
  }, [session?.voice_ref, voices]);

  useEffect(() => {
    setStoryPage(1);
  }, [ageFilter, storyQuery, storySource, themeFilter]);

  useEffect(() => {
    setStoryPage((current) => Math.min(current, totalStoryPages));
  }, [totalStoryPages]);

  useEffect(() => {
    setCharacterPage(1);
  }, [characterQuery, characterSourceFilter]);

  useEffect(() => {
    setCharacterPage((current) => Math.min(current, totalCharacterPages));
  }, [totalCharacterPages]);

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

  useEffect(() => {
    if (!task || !session || (task.status !== "queued" && task.status !== "running")) {
      return;
    }
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const nextTask = await creationApi.getTask(task.id);
        if (cancelled) return;
        if (nextTask.status !== "queued" && nextTask.status !== "running") {
          window.clearInterval(timer);
          const nextSession = await creationApi.getSession(session.id);
          if (!cancelled) {
            setSession(nextSession);
            setTask(nextTask);
          }
          return;
        }
        setTask(nextTask);
      } catch {
        window.clearInterval(timer);
      }
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session, task]);

  const activeSteps = path === "template" ? templateSteps : storySteps;
  const activeStepIndex = activeSteps.findIndex((item) => item.value === step);
  const canUseTemplate = path === "template" && selectedTemplate !== null;
  const language = selectedStory?.language ?? "zh";
  const storyCharacters = selectedStoryDetail?.characters ?? [];
  const voiceRoleOptions = useMemo<VoiceRoleOption[]>(
    () => [
      { roleCode: "narration", label: "旁白", desc: "用于整本朗读和无角色正文" },
      ...storyCharacters.map((character, index) => ({
        roleCode: roleCodeFor(character, index),
        label: character.name,
        desc: character.is_protagonist ? "主角对白声音" : "角色对白声音",
      })),
    ],
    [storyCharacters],
  );

  useEffect(() => {
    const firstRoleCode = storyCharacters.length ? roleCodeFor(storyCharacters[0], 0) : null;
    setSelectedStoryRoleCode((current) => (current && storyCharacters.some((character, index) => roleCodeFor(character, index) === current) ? current : firstRoleCode));
  }, [storyCharacters]);

  const previewItems = useMemo<Array<[string, string]>>(
    () => [
      ["路径", path === "story" ? "基于故事生成" : "基于模板创作"],
      ["来源", path === "story" ? sourceLabel(storySource) : selectedTemplate?.title ?? "待选择"],
      ["故事", path === "story" ? selectedStory?.title ?? "待选择" : selectedTemplate?.title ?? "待选择"],
      ["页数", `${targetPageCount} 页`],
      ["语言", language === "bilingual" ? "中英双语" : language === "en" ? "英文" : "中文"],
      ["画风", path === "story" ? selectedArtStyle?.name ?? "待选择" : "模板锁定"],
      ["形象", session?.character_refs?.length ? `${session.character_refs.length} 个角色` : "待确认"],
      ["声音", session?.voice_ref ? String(session.voice_ref.display_name ?? "已选择") : "待选择"],
      ["对口型", session?.page_drafts?.some((page) => page.lip_sync_url) ? "已生成" : "可跳过"],
    ],
    [language, path, selectedArtStyle?.name, selectedStory?.title, selectedTemplate?.title, session?.character_refs, session?.page_drafts, session?.voice_ref, storySource, targetPageCount],
  );
  const isTaskActive = task?.status === "queued" || task?.status === "running";
  const isTaskSucceeded = task?.status === "succeeded";
  const pageDrafts = session?.page_drafts ?? [];
  const storybookMediaReady =
    path === "template" ||
    (pageDrafts.length > 0 && pageDrafts.every((page) => page.image_status === "ready" && page.audio_status === "ready" && page.image_url && page.audio_url));
  const canContinueFromStoryboard = path === "template" || !!session;
  const canContinueFromVoice = path === "template" || !!session;

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
      target_page_count: targetPageCount,
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
      setStep(path === "template" ? "character" : "style");
    });

  const handleConfirmCharacters = () =>
    run(async () => {
      const current = await ensureSession();
      const characterRefs: CharacterRef[] = storyCharacters.map((storyCharacter, index) => {
        const roleCode = roleCodeFor(storyCharacter, index);
        const selectedCharacter = selectedCharactersByRole[roleCode] ?? null;
        return selectedCharacter
          ? {
              source: selectedCharacter.owner_user_id === null ? "system_character" : "user_character",
              character_id: selectedCharacter.id,
              role_code: roleCode,
              display_name: selectedCharacter.name,
              story_character_name: storyCharacter.name,
              is_protagonist: storyCharacter.is_protagonist,
            }
          : {
              source: "generated",
              character_id: null,
              role_code: roleCode,
              display_name: storyCharacter.name,
              story_character_name: storyCharacter.name,
              is_protagonist: storyCharacter.is_protagonist,
            };
      });
      const updated = await creationApi.updateConfig(current.id, { character_refs: characterRefs });
      setSession(updated);
      if (path === "template") {
        setStep("voice");
        return;
      }
      setStep("storyboard");
    });

  const handleGenerateStoryboard = () =>
    run(async () => {
      const current = await ensureSession();
      const configured =
        current.target_page_count === targetPageCount
          ? current
          : await creationApi.updateConfig(current.id, { target_page_count: targetPageCount });
      setSession(configured);
      const response = await creationApi.generateStoryboard(configured.id);
      setSession(response.session);
      setTask(response.task);
      setStep("storyboard");
    });

  const handleConfirmStyle = () =>
    run(async () => {
      const current = await ensureSession();
      if (!selectedArtStyle) {
        setMessage("请先选择一个画风");
        return;
      }
      const artStyleRef: ArtStyleRef = {
        source: selectedArtStyle.owner_user_id === null ? "system" : "custom",
        art_style_code: selectedArtStyle.code,
        art_style_id: selectedArtStyle.id,
        custom_prompt: selectedArtStyle.owner_user_id !== null ? selectedArtStyle.prompt : null,
      };
      const updated = await creationApi.updateConfig(current.id, { art_style_ref: artStyleRef });
      setSession(updated);
      setSelectedCharactersByRole((currentSelection) =>
        Object.fromEntries(
          Object.entries(currentSelection).filter(([, character]) =>
            character
              ? character.art_style_id === selectedArtStyle.id || (!!selectedArtStyle.code && character.art_style_code === selectedArtStyle.code)
              : true,
          ),
        ),
      );
      setStep("character");
    });

  const handleGenerateImages = () =>
    run(async () => {
      if (!session) return;
      const response = await creationApi.generateImages(session.id);
      setSession(response.session);
      setTask(response.task);
    });

  const voiceRefForSelection = (roleCode: string, voice: VoiceSummary | null): VoiceRef => (
    voice
      ? {
          source: voice.owner_user_id === null ? "system" : "user",
          voice_id: voice.id,
          display_name: voice.name,
          role_code: roleCode,
        }
      : { source: "system", display_name: "系统默认声音", role_code: roleCode }
  );

  const updateVoiceConfig = async () => {
    const current = await ensureSession();
    const narrationVoice = selectedVoicesByRole.narration ?? null;
    const voiceRef: VoiceRef =
      path === "template" && !narrationVoice
        ? { source: "template_default", display_name: "模板默认声音", role_code: "narration" }
        : {
            ...voiceRefForSelection("narration", narrationVoice),
            role_voice_refs: voiceRoleOptions
              .filter((role) => role.roleCode !== "narration" && selectedVoicesByRole[role.roleCode])
              .map((role) => voiceRefForSelection(role.roleCode, selectedVoicesByRole[role.roleCode] ?? null)),
          };
    const updated = await creationApi.updateConfig(current.id, { voice_ref: voiceRef });
    setSession(updated);
    return updated;
  };

  const handleGenerateAllAudio = () =>
    run(async () => {
      const updated = await updateVoiceConfig();
      const response = await creationApi.generateAudio(updated.id);
      setSession(response.session);
      setTask(response.task);
    });

  const handleGeneratePageAudio = (pageId: number) =>
    run(async () => {
      const updated = await updateVoiceConfig();
      const response = await creationApi.generateAudio(updated.id, [pageId]);
      setSession(response.session);
      setTask(response.task);
    });

  const handleContinueFromVoice = () =>
    run(async () => {
      await updateVoiceConfig();
      setStep(path === "story" ? "lipSync" : "preview");
    });

  const handleGenerateLipSync = () =>
    run(async () => {
      if (!session) return;
      const response = await creationApi.generateLipSync(session.id);
      setSession(response.session);
      setTask(response.task);
    });

  const handleSkipLipSync = () => {
    setStep("preview");
  };

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

        <div className="mb-5 grid grid-cols-7 gap-2 max-lg:grid-cols-4 max-md:grid-cols-3">
          {activeSteps.map((item, index) => (
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

          {step === "character" ? (
            <CharacterStep
              assetCharacters={pagedCharacters}
              charactersLoading={charactersLoading}
              page={characterPage}
              path={path}
              query={characterQuery}
              selectedCharactersByRole={selectedCharactersByRole}
              selectedRoleCode={selectedStoryRoleCode}
              sourceFilter={characterSourceFilter}
              storyCharacters={storyCharacters}
              total={visibleCharacters.length}
              totalPages={totalCharacterPages}
              onPageChange={setCharacterPage}
              onQueryChange={setCharacterQuery}
              onSelectAssetCharacter={(character) => {
                if (!selectedStoryRoleCode) return;
                setSelectedCharactersByRole((current) => ({ ...current, [selectedStoryRoleCode]: character }));
                setSession(null);
                setTask(null);
                setMessage(null);
              }}
              onSelectStoryRole={setSelectedStoryRoleCode}
              onSourceFilterChange={setCharacterSourceFilter}
            />
          ) : null}
          {step === "style" ? (
            <StyleStep
              artStyles={artStyles}
              artStylesLoading={artStylesLoading}
              selectedArtStyleId={selectedArtStyle?.id ?? null}
              onSelectArtStyle={(artStyle) => {
                setSelectedArtStyle(artStyle);
                setSelectedCharactersByRole({});
                setSession(null);
                setTask(null);
                setMessage(null);
              }}
            />
          ) : null}
          {step === "storyboard" ? (
            <StoryboardStep
              isGenerating={busy || isTaskActive}
              session={session}
              targetPageCount={targetPageCount}
              onGenerateStoryboard={handleGenerateStoryboard}
              onSessionChange={setSession}
              onTargetPageCountChange={setTargetPageCount}
            />
          ) : null}
          {step === "voice" ? (
            <VoiceStep
              isGenerating={busy || isTaskActive}
              path={path}
              roleOptions={voiceRoleOptions}
              selectedVoicesByRole={selectedVoicesByRole}
              session={session}
              voices={voices}
              voicesLoading={voicesLoading}
              onGenerateAllAudio={handleGenerateAllAudio}
              onGeneratePageAudio={handleGeneratePageAudio}
              onSelectVoice={(roleCode, voice) => {
                setSelectedVoicesByRole((current) => ({ ...current, [roleCode]: voice }));
                setTask(null);
                setMessage(null);
              }}
            />
          ) : null}
          {step === "lipSync" ? <LipSyncStep session={session} /> : null}
          {step === "preview" ? <PreviewStep previewItems={previewItems} /> : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button type="button" variant="ghost" disabled={step === "source" || busy} onClick={() => setStep(activeSteps[Math.max(0, activeStepIndex - 1)].value)}>
              上一步
            </Button>
            {step === "source" ? <Button disabled={busy} onClick={handleContinueFromSource}>{path === "template" ? "下一步：选择形象" : "下一步：确定画风"}</Button> : null}
            {step === "style" ? <Button disabled={busy} onClick={handleConfirmStyle}>下一步：选择形象</Button> : null}
            {step === "character" ? <Button disabled={busy} onClick={handleConfirmCharacters}>{path === "template" ? "下一步：选择声音" : "下一步：设置分镜"}</Button> : null}
            {step === "storyboard" ? (
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || isTaskActive} onClick={handleGenerateImages}>生成全部插图</Button>
                <Button type="button" variant="secondary" disabled={busy || isTaskActive || !canContinueFromStoryboard} onClick={() => setStep("voice")}>
                  下一步：选择声音
                </Button>
              </div>
            ) : null}
            {step === "voice" ? (
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || isTaskActive || !session} onClick={handleGenerateAllAudio}>生成全部语音</Button>
                <Button type="button" variant="secondary" disabled={busy || !canContinueFromVoice} onClick={handleContinueFromVoice}>
                  {path === "story" ? "下一步：对口型" : "下一步：预览"}
                </Button>
              </div>
            ) : null}
            {step === "lipSync" ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={handleSkipLipSync}>
                  跳过对口型
                </Button>
                <Button disabled={busy || isTaskActive || !storybookMediaReady} onClick={handleGenerateLipSync}>
                  生成对口型
                </Button>
                <Button type="button" variant="secondary" disabled={busy || isTaskActive} onClick={() => setStep("preview")}>
                  下一步：预览
                </Button>
              </div>
            ) : null}
            {step === "preview" ? <Button disabled={busy || !session || !storybookMediaReady} onClick={handleSave}>保存到我的绘本库</Button> : null}
          </div>
        </section>
      </section>

      <aside className="sticky top-8 space-y-5 self-start">
        {step === "source" && path === "story" ? (
          <SelectedStoryBodyPanel story={selectedStory} storyDetail={selectedStoryDetail} />
        ) : step === "character" ? (
          <section className="app-card p-5">
            <h2 className="font-display text-2xl">角色形象</h2>
            <dl className="mt-4 space-y-3">
              {storyCharacters.length ? storyCharacters.map((character, index) => {
                const roleCode = roleCodeFor(character, index);
                const selectedCharacter = selectedCharactersByRole[roleCode] ?? null;
                return (
                  <div key={roleCode} className="border-b border-[rgba(212,114,92,0.08)] pb-3 text-sm">
                    <dt className="font-bold text-[var(--text-dark)]">{character.name}{character.is_protagonist ? "（主角）" : ""}</dt>
                    <dd className="mt-1 text-[var(--text-light)]">{selectedCharacter?.name ?? "不指定形象，AI生成"}</dd>
                  </div>
                );
              }) : (
                <p className="text-sm leading-6 text-[var(--text-light)]">故事没有角色定义，系统会按正文生成形象。</p>
              )}
            </dl>
          </section>
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
