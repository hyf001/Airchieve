import React from "react";
import { BookOpenText, Crown, FileText, Pencil, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type StorySummary } from "./types";
import { cn } from "@/lib/utils";

interface StoryCardProps {
  labels?: StoryLabelMaps;
  story: StorySummary;
  onDelete?: (story: StorySummary) => void;
  onEdit?: (story: StorySummary) => void;
  onOpen?: (story: StorySummary) => void;
  onStartCreation?: (story: StorySummary) => void;
}

interface StoryLabelMaps {
  ageRange?: Record<string, string>;
  theme?: Record<string, string>;
  educationGoal?: Record<string, string>;
}

export const StoryCard: React.FC<StoryCardProps> = ({ labels, story, onDelete, onEdit, onOpen, onStartCreation }) => (
  <article className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border-[2.5px] border-transparent bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]">
    <div className="absolute right-3.5 top-3.5 z-20 flex gap-2">
      {onEdit ? (
        <Button aria-label={`编辑${story.title}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={() => onEdit(story)}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button aria-label={`删除${story.title}`} className="bg-white/90" size="icon" type="button" variant="ghost" onClick={() => onDelete(story)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
    <button className="block flex-1 text-left" type="button" onClick={() => onOpen?.(story)}>
      <div
        className={cn(
          "relative flex h-[150px] items-center justify-center overflow-hidden",
          story.source_type === "system"
            ? "bg-[linear-gradient(135deg,rgba(126,200,227,0.2),rgba(179,157,219,0.2))]"
            : story.source_type === "generated_idea"
              ? "bg-[linear-gradient(135deg,rgba(245,166,35,0.18),rgba(139,198,168,0.2))]"
              : "bg-[linear-gradient(135deg,rgba(212,114,92,0.14),rgba(126,200,227,0.16))]",
        )}
      >
        {story.cover_url ? <img alt={story.title} className="h-full w-full object-cover" src={story.cover_url} /> : <FileText className="h-12 w-12 text-white drop-shadow-[0_3px_12px_rgba(61,44,44,0.18)]" />}
        <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-2">
          {story.source_type !== "generated_idea" ? <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--text-mid)]">{sourceLabel(story.source_type)}</span> : null}
          {story.source_type === "generated_idea" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">
              <Sparkles className="h-3 w-3" />
              AI生成
            </span>
          ) : null}
          {story.access_level === "vip" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--honey)]">
              <Crown className="h-3 w-3" />
              VIP
            </span>
          ) : null}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-xl leading-snug text-[var(--text-dark)]">{story.title}</h3>
            <p className="mt-1 text-xs font-bold text-[var(--text-light)]">{languageLabel(story.language)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[rgba(126,200,227,0.14)] px-2.5 py-1 text-xs font-bold text-[var(--sky-deep)]">
            {accessLevelLabel(story.access_level)}
          </span>
        </div>
        <p className="mt-3 line-clamp-3 min-h-[72px] text-[13px] leading-6 text-[var(--text-mid)]">{story.summary ?? "暂无简介"}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cardTags(story, labels).slice(0, 4).map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
        </div>
      </div>
    </button>
    <div className="flex flex-wrap gap-2 px-5 pb-5">
      <Button size="sm" type="button" variant="outline" onClick={() => onOpen?.(story)}>
        详情
      </Button>
      <Button size="sm" type="button" onClick={() => onStartCreation?.(story)}>
        <BookOpenText className="h-3.5 w-3.5" />
        生成绘本
      </Button>
    </div>
  </article>
);

const sourceLabel = (sourceType: StorySummary["source_type"]) => {
  if (sourceType === "system") return "系统故事";
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

const cardTags = (story: StorySummary, labels?: StoryLabelMaps) => {
  const tags = [
    ...story.age_range_codes.map((code) => labels?.ageRange?.[code] ?? code),
    ...story.theme_codes.map((code) => labels?.theme?.[code] ?? code),
    ...story.education_goal_codes.map((code) => labels?.educationGoal?.[code] ?? code),
  ];
  return tags.length ? tags : ["纯文本故事"];
};

const Tag: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 text-xs font-semibold text-[var(--text-mid)]">
    {children}
  </span>
);
