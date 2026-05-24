import React from "react";

import { Button } from "@/components/ui/button";
import { StoryCard, type StorySummary } from "@/entities/story";

import { SelectableTile } from "../components";
import { storySources } from "../constants";
import type { CreationStorySourceType } from "../types";

export const StorySourceStep: React.FC<{
  ageFilter: string;
  ageRangeOptions: { code: string; name: string }[];
  labels: {
    ageRange: Record<string, string>;
    theme: Record<string, string>;
    educationGoal: Record<string, string>;
  };
  page: number;
  storySource: CreationStorySourceType;
  setStorySource: (value: CreationStorySourceType) => void;
  stories: StorySummary[];
  storiesLoading: boolean;
  storyQuery: string;
  selectedStoryId: number | null;
  themeFilter: string;
  themeOptions: { code: string; name: string }[];
  total: number;
  totalPages: number;
  onAgeFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onSelectStory: (story: StorySummary) => void;
  onStoryQueryChange: (value: string) => void;
  onThemeFilterChange: (value: string) => void;
}> = ({
  ageFilter,
  ageRangeOptions,
  labels,
  page,
  storySource,
  setStorySource,
  stories,
  storiesLoading,
  storyQuery,
  selectedStoryId,
  themeFilter,
  themeOptions,
  total,
  totalPages,
  onAgeFilterChange,
  onPageChange,
  onSelectStory,
  onStoryQueryChange,
  onThemeFilterChange,
}) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      {storySources.map((source) => (
        <SelectableTile key={source.value} selected={storySource === source.value} title={source.title} desc={source.desc} onClick={() => setStorySource(source.value)} />
      ))}
    </div>
    <div className="grid grid-cols-[1fr_160px_160px] gap-3 max-md:grid-cols-1">
      <input
        className="h-10 rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm outline-none focus:border-[var(--honey)]"
        value={storyQuery}
        onChange={(event) => onStoryQueryChange(event.target.value)}
        placeholder="搜索故事标题或简介"
      />
      <select
        className="h-10 rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm outline-none focus:border-[var(--honey)]"
        value={ageFilter}
        onChange={(event) => onAgeFilterChange(event.target.value)}
      >
        <option value="">全部适龄</option>
        {ageRangeOptions.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>
      <select
        className="h-10 rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm outline-none focus:border-[var(--honey)]"
        value={themeFilter}
        onChange={(event) => onThemeFilterChange(event.target.value)}
      >
        <option value="">全部主题</option>
        {themeOptions.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
    {storiesLoading ? <div className="app-card p-5 text-sm text-[var(--text-light)]">正在加载故事...</div> : null}
    {!storiesLoading && stories.length === 0 ? <div className="app-card p-5 text-sm text-[var(--text-light)]">当前分类下暂无故事，请先到故事库添加。</div> : null}
    {stories.length ? (
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        {stories.map((story) => (
          <StoryCard key={story.id} hideActions labels={labels} selected={story.id === selectedStoryId} story={story} onOpen={() => onSelectStory(story)} />
        ))}
      </div>
    ) : null}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-light)]">
      <span>
        共 {total} 个故事，第 {page} / {totalPages} 页
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          上一页
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          下一页
        </Button>
      </div>
    </div>
  </div>
);
