import React from "react";

import { type BookLanguage, type BookPage } from "./types";

interface BookPageViewProps {
  page: BookPage;
  textMode: BookLanguage;
  bilingualEnglishFirst: boolean;
  isPlaying: boolean;
}

export const BookPageView: React.FC<BookPageViewProps> = ({ page, textMode, bilingualEnglishFirst, isPlaying }) => {
  const zh = page.text_zh || page.narration_text || "";
  const en = page.text_en || "";
  const paragraphs =
    textMode === "bilingual"
      ? bilingualEnglishFirst
        ? [en, zh]
        : [zh, en]
      : [textMode === "en" ? en || zh : zh || en];

  return (
    <div className="grid grid-cols-[minmax(240px,1fr)_minmax(260px,0.9fr)] gap-5 max-lg:grid-cols-1">
      <div className="relative min-h-[320px] overflow-hidden rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,rgba(126,200,227,0.35),rgba(139,198,168,0.35))]">
        {page.image_url ? (
          <img className="h-full min-h-[320px] w-full object-cover" src={page.image_url} alt="" />
        ) : (
          <div className="flex min-h-[320px] items-center justify-center p-8 text-center">
            <div>
              <div className="font-display text-4xl text-[var(--text-dark)]">{page.title || `第 ${page.page_no} 页`}</div>
              <p className="mt-4 max-w-xl text-sm text-[var(--text-mid)]">{page.visual_prompt || zh}</p>
            </div>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[var(--text-mid)]">
          第 {page.page_no} 页
        </span>
      </div>

      <div className="app-card flex min-h-[320px] flex-col justify-center p-6">
        {page.title ? <h2 className="font-display mb-4 text-2xl text-[var(--text-dark)]">{page.title}</h2> : null}
        <div className="space-y-4">
          {paragraphs.filter(Boolean).map((text) => (
            <p
              key={text}
              className={
                isPlaying
                  ? "rounded-[var(--radius-md)] bg-[rgba(245,166,35,0.12)] px-4 py-3 text-lg font-semibold leading-8 text-[var(--text-dark)]"
                  : "px-4 py-3 text-lg font-semibold leading-8 text-[var(--text-dark)]"
              }
            >
              {text}
            </p>
          ))}
        </div>
        {page.dialogues.length > 0 ? (
          <div className="mt-5 space-y-2">
            {page.dialogues.map((dialogue) => (
              <div key={dialogue.id} className="rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.12)] px-3 py-2 text-sm">
                <span className="font-bold text-[var(--sky-deep)]">{dialogue.character_ref}</span>
                <span className="ml-2 text-[var(--text-mid)]">{dialogue.text}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};
