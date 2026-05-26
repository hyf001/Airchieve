import React, { useState } from "react";
import { Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaxonomyMultiSelect, TaxonomySelect } from "@/entities/taxonomy";
import type { StoryCharacter, StoryLanguage } from "./types";
import { type StoryGeneratePayload, type StoryPayload } from "./types";

interface StoryEditorProps {
  mode: "ai" | "paste";
  onSubmit: (payload: StoryPayload) => Promise<void> | void;
  onGenerate: (payload: StoryGeneratePayload) => Promise<void> | void;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({ mode, onGenerate, onSubmit }) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [ideaPrompt, setIdeaPrompt] = useState("");
  const [storyCharacters, setStoryCharacters] = useState<StoryCharacter[]>([{ name: "", is_protagonist: true }]);
  const [language, setLanguage] = useState<StoryLanguage>("zh");
  const [ageRangeCodes, setAgeRangeCodes] = useState<string[]>([]);
  const [themeCodes, setThemeCodes] = useState<string[]>([]);
  const [educationGoalCodes, setEducationGoalCodes] = useState<string[]>([]);
  const [narrativeStyleCode, setNarrativeStyleCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isAiMode = mode === "ai";
  const normalizedCharacters = storyCharacters
    .map((character) => ({ name: character.name.trim(), is_protagonist: character.is_protagonist }))
    .filter((character) => character.name);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isAiMode) {
        await onGenerate({
          idea_prompt: ideaPrompt,
          characters: normalizedCharacters,
          age_range_codes: ageRangeCodes,
          theme_codes: themeCodes,
          education_goal_codes: educationGoalCodes,
          language,
          narrative_style_code: narrativeStyleCode,
        });
      } else {
        await onSubmit({
          title,
          summary: summary || null,
          body,
          source_type: "uploaded",
          characters: normalizedCharacters,
          age_range_codes: ageRangeCodes,
          theme_codes: themeCodes,
          education_goal_codes: educationGoalCodes,
          language,
          narrative_style_code: narrativeStyleCode,
        });
      }
      setTitle("");
      setSummary("");
      setBody("");
      setIdeaPrompt("");
      setStoryCharacters([{ name: "", is_protagonist: true }]);
      setLanguage("zh");
      setAgeRangeCodes([]);
      setThemeCodes([]);
      setEducationGoalCodes([]);
      setNarrativeStyleCode(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="font-display text-2xl">{isAiMode ? "AI 创建故事" : "黏贴保存故事"}</h2>
        <p className="mt-1 text-sm text-[var(--text-light)]">
          {isAiMode ? "输入故事灵感，系统会生成一篇可用于绘本创作的纯文本故事。" : "请只黏贴你有权使用的纯文本故事。"}
        </p>
      </div>
      {!isAiMode ? (
        <>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="故事标题" required maxLength={160} />
          <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话简介" maxLength={1000} />
        </>
      ) : null}
      {isAiMode ? (
        <>
          <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
            故事灵感
            <textarea
              className="min-h-[180px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.15)] bg-white px-4 py-3 text-sm font-normal outline-none transition-all placeholder:text-[var(--text-light)] focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
              value={ideaPrompt}
              onChange={(event) => setIdeaPrompt(event.target.value)}
              placeholder="写下角色、场景、主题或想传达的道理"
              required
              maxLength={1000}
            />
          </label>
          <StoryCharacterFields characters={storyCharacters} required onChange={setStoryCharacters} />
          <StoryMetadataFields
            ageRangeCodes={ageRangeCodes}
            educationGoalCodes={educationGoalCodes}
            language={language}
            narrativeStyleCode={narrativeStyleCode}
            themeCodes={themeCodes}
            onAgeRangeCodesChange={setAgeRangeCodes}
            onEducationGoalCodesChange={setEducationGoalCodes}
            onLanguageChange={setLanguage}
            onNarrativeStyleCodeChange={setNarrativeStyleCode}
            onThemeCodesChange={setThemeCodes}
          />
        </>
      ) : (
        <>
          <textarea
            className="min-h-[220px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.15)] bg-white px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--text-light)] focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="黏贴故事正文，最多 3000 字"
            required
            maxLength={3000}
          />
          <StoryCharacterFields characters={storyCharacters} onChange={setStoryCharacters} />
          <StoryMetadataFields
            ageRangeCodes={ageRangeCodes}
            educationGoalCodes={educationGoalCodes}
            language={language}
            narrativeStyleCode={narrativeStyleCode}
            themeCodes={themeCodes}
            onAgeRangeCodesChange={setAgeRangeCodes}
            onEducationGoalCodesChange={setEducationGoalCodes}
            onLanguageChange={setLanguage}
            onNarrativeStyleCodeChange={setNarrativeStyleCode}
            onThemeCodesChange={setThemeCodes}
          />
        </>
      )}
      <Button type="submit" disabled={submitting || (isAiMode ? !ideaPrompt || normalizedCharacters.length === 0 : !title || !body)}>
        {isAiMode ? <Sparkles className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {submitting ? "提交中..." : isAiMode ? "开始生成" : "保存故事"}
      </Button>
    </form>
  );
};

const StoryCharacterFields: React.FC<{
  characters: StoryCharacter[];
  required?: boolean;
  onChange: (characters: StoryCharacter[]) => void;
}> = ({ characters, required = false, onChange }) => {
  const updateCharacter = (index: number, patch: Partial<StoryCharacter>) => {
    onChange(characters.map((character, itemIndex) => (itemIndex === index ? { ...character, ...patch } : character)));
  };

  const removeCharacter = (index: number) => {
    onChange(characters.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section className="grid gap-3 rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(126,200,227,0.06)] p-4">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-dark)]">故事角色{required ? "" : "（选填）"}</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-light)]">
          AI 生成故事时会按这里的角色写作；后续创作绘本时会逐个为这些角色选择形象。
        </p>
      </div>
      <div className="grid gap-2">
        {characters.map((character, index) => (
          <div key={index} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 max-sm:grid-cols-1">
            <Input
              value={character.name}
              onChange={(event) => updateCharacter(index, { name: event.target.value })}
              placeholder={index === 0 ? "角色姓名，例如 小雨" : "角色姓名"}
              maxLength={120}
              required={required && index === 0}
            />
            <label className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-white px-3 text-sm font-semibold text-[var(--text-mid)]">
              <input
                type="checkbox"
                checked={character.is_protagonist}
                onChange={(event) => updateCharacter(index, { is_protagonist: event.target.checked })}
              />
              主角
            </label>
            <Button type="button" size="sm" variant="ghost" disabled={characters.length === 1} onClick={() => removeCharacter(index)}>
              删除
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...characters, { name: "", is_protagonist: false }])}>
        添加角色
      </Button>
    </section>
  );
};

const StoryMetadataFields: React.FC<{
  ageRangeCodes: string[];
  educationGoalCodes: string[];
  language: StoryLanguage;
  narrativeStyleCode: string | null;
  themeCodes: string[];
  onAgeRangeCodesChange: (codes: string[]) => void;
  onEducationGoalCodesChange: (codes: string[]) => void;
  onLanguageChange: (language: StoryLanguage) => void;
  onNarrativeStyleCodeChange: (code: string | null) => void;
  onThemeCodesChange: (codes: string[]) => void;
}> = ({
  ageRangeCodes,
  educationGoalCodes,
  language,
  narrativeStyleCode,
  themeCodes,
  onAgeRangeCodesChange,
  onEducationGoalCodesChange,
  onLanguageChange,
  onNarrativeStyleCodeChange,
  onThemeCodesChange,
}) => (
  <div className="grid gap-4 rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-[rgba(212,114,92,0.04)] p-4">
    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
      <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
        语言
        <select
          className="h-10 rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm font-normal text-[var(--text-dark)] outline-none focus:border-[var(--honey)]"
          value={language}
          onChange={(event) => onLanguageChange(event.target.value as StoryLanguage)}
          required
        >
          <option value="zh">中文</option>
          <option value="en">英文</option>
          <option value="bilingual">中英双语</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
        叙事风格
        <TaxonomySelect type="narrative_style" value={narrativeStyleCode} onChange={onNarrativeStyleCodeChange} placeholder="不指定" />
      </label>
    </div>
    <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
      适龄范围
      <TaxonomyMultiSelect type="age_range" value={ageRangeCodes} onChange={onAgeRangeCodesChange} />
    </label>
    <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
      主题方向
      <TaxonomyMultiSelect type="theme" value={themeCodes} onChange={onThemeCodesChange} />
    </label>
    <label className="grid gap-1.5 text-sm font-bold text-[var(--text-mid)]">
      教育目标
      <TaxonomyMultiSelect type="education_goal" value={educationGoalCodes} onChange={onEducationGoalCodesChange} />
    </label>
  </div>
);
