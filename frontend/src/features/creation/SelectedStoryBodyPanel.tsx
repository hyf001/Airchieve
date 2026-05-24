import React from "react";

import type { StoryDetail, StorySummary } from "@/entities/story";

export const SelectedStoryBodyPanel: React.FC<{
  story: StorySummary | null;
  storyDetail: StoryDetail | null;
}> = ({ story, storyDetail }) => (
  <section className="app-card p-5">
    <h2 className="font-display text-2xl">故事正文</h2>
    {!story ? (
      <p className="mt-3 text-sm text-[var(--text-light)]">请先选择一个故事。</p>
    ) : (
      <div className="mt-4 max-h-[calc(100vh-10rem)] overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--cream)] p-3 text-sm leading-7 text-[var(--text-mid)]">
        {storyDetail?.body ?? "正在加载正文..."}
      </div>
    )}
  </section>
);
