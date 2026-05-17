import React from "react";
import { BookOpenText, Crown, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type StorySummary } from "./types";

interface StoryCardProps {
  story: StorySummary;
  onOpen?: (story: StorySummary) => void;
  onStartCreation?: (story: StorySummary) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, onOpen, onStartCreation }) => (
  <article className="app-card app-card-hover flex h-full flex-col p-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.16)] text-[var(--sky-deep)]">
        <FileText className="h-6 w-6" />
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[rgba(212,114,92,0.08)] px-2 py-1 text-[11px] font-bold text-[var(--text-mid)]">
        {story.access_level === "vip" && <Crown className="h-3 w-3 text-[var(--honey)]" />}
        {story.source_type === "system" ? "系统故事" : "我的故事"}
      </span>
    </div>
    <h3 className="line-clamp-2 min-h-11 text-base font-bold leading-snug">{story.title}</h3>
    <p className="mt-2 line-clamp-3 min-h-[60px] text-sm text-[var(--text-light)]">{story.summary ?? "暂无简介"}</p>
    <div className="mt-4 flex flex-wrap gap-1.5">
      <Tag>{story.language === "bilingual" ? "双语" : story.language === "en" ? "英文" : "中文"}</Tag>
      <Tag>{story.access_level === "vip" ? "VIP" : "免费"}</Tag>
    </div>
    <div className="mt-auto flex gap-2 pt-5">
      <Button variant="outline" className="flex-1" onClick={() => onOpen?.(story)}>
        详情
      </Button>
      <Button className="flex-1" onClick={() => onStartCreation?.(story)}>
        <BookOpenText className="h-4 w-4" />
        生成
      </Button>
    </div>
  </article>
);

const Tag: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--text-mid)] shadow-[var(--shadow-soft)]">
    {children}
  </span>
);
