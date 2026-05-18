import React from "react";

import { type BookLearningCard } from "./types";

export const LearningCards: React.FC<{ cards: BookLearningCard[] }> = ({ cards }) => {
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-3">
      {cards.map((card) => (
        <article key={card.id} className="app-card p-4">
          <h3 className="font-display text-xl">{card.theme || "学习卡片"}</h3>
          <Info label="目标" values={card.education_goals} />
          <Info label="词汇" values={card.vocabulary} />
          <Info label="讨论" values={card.discussion_questions} />
        </article>
      ))}
    </div>
  );
};

const Info: React.FC<{ label: string; values: string[] }> = ({ label, values }) => {
  if (values.length === 0) return null;
  return (
    <div className="mt-3 text-sm">
      <span className="font-bold text-[var(--text-dark)]">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className="rounded-full bg-[rgba(139,198,168,0.14)] px-3 py-1 text-xs font-semibold text-[var(--sage-deep)]">
            {value}
          </span>
        ))}
      </div>
    </div>
  );
};
