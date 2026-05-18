import React from "react";
import { MessageCircleQuestion } from "lucide-react";

import { type BookReadingPrompt } from "./types";

export const CoReadingPrompts: React.FC<{ prompts: BookReadingPrompt[]; currentPageNo: number }> = ({ prompts, currentPageNo }) => {
  const visible = prompts.filter((prompt) => !prompt.page_no || prompt.page_no === currentPageNo);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-3">
      {visible.map((prompt) => (
        <div key={prompt.id} className="app-card flex gap-3 p-4">
          <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-[var(--terracotta)]" />
          <div>
            <div className="text-xs font-bold text-[var(--text-light)]">{prompt.prompt_type === "question" ? "共读提问" : "互动提示"}</div>
            <p className="mt-1 text-sm font-semibold text-[var(--text-dark)]">{prompt.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
