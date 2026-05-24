import React from "react";
import { Image } from "lucide-react";

import { StepPanel } from "../components";
import type { CreationSession } from "../types";

export const StoryboardStep: React.FC<{ session: CreationSession | null }> = ({ session }) => (
  <StepPanel icon={<Image className="h-5 w-5" />} title="编辑分镜" desc="分镜包含每页标题、正文、画面描述、出场形象和对白标记。">
    <div className="space-y-3">
      {(session?.storyboard_pages ?? []).map((page) => (
        <div key={page.id} className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-[var(--warm-bg)] p-4">
          <div className="flex justify-between gap-3">
            <h3 className="font-bold">
              第 {page.page_no} 页 · {page.title}
            </h3>
            <span className="text-xs font-semibold text-[var(--sage-deep)]">{page.generation_status}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--text-mid)]">{page.text_zh}</p>
          <p className="mt-2 text-xs text-[var(--text-light)]">{page.visual_prompt}</p>
        </div>
      ))}
    </div>
  </StepPanel>
);
