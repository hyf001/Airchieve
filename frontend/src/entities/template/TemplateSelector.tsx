import React from "react";

import { Button } from "@/components/ui/button";

import type { TemplateSummary } from "./types";

interface TemplateSelectorProps {
  templates: TemplateSummary[];
  selectedId: number | null;
  onSelect: (template: TemplateSummary) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({ templates, selectedId, onSelect }) => {
  if (templates.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[rgba(212,114,92,0.18)] bg-white p-5 text-sm text-[var(--text-light)]">
        暂无已发布模板。你仍可先使用“基于故事生成绘本”路径。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={`rounded-[var(--radius-md)] border bg-white p-4 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 ${
            selectedId === template.id ? "border-[var(--terracotta)]" : "border-[rgba(212,114,92,0.1)]"
          }`}
          onClick={() => onSelect(template)}
        >
          <div className="flex h-28 items-center justify-center rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,#ffe0b2,#c8e6c9)] text-4xl">
            {template.cover_url ? <img className="h-full w-full rounded-[var(--radius-sm)] object-cover" src={template.cover_url} alt="" /> : "📚"}
          </div>
          <div className="mt-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-[var(--text-dark)]">{template.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-light)]">{template.summary ?? "替换角色头像和朗读声音，保留原绘本结构。"}</p>
            </div>
            {template.access_level === "vip" ? (
              <span className="rounded-md bg-[var(--honey)] px-2 py-0.5 text-xs font-bold text-white">VIP</span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-mid)]">
            <span className="rounded-md bg-[rgba(139,198,168,0.16)] px-2 py-1">{template.page_count ?? "-"} 页</span>
            <span className="rounded-md bg-[rgba(126,200,227,0.16)] px-2 py-1">{template.character_count} 个可替换角色</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export const TemplateLockedNotice: React.FC = () => (
  <div className="rounded-[var(--radius-md)] bg-[rgba(212,114,92,0.08)] p-4 text-sm text-[var(--text-mid)]">
    模板创作只替换已标注角色区域和朗读声音，画风、正文、背景、构图和播放节奏保持锁定。
  </div>
);
