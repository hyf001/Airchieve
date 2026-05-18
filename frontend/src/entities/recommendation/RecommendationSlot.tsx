import React from "react";

import { BookGrid, type BookSummary } from "@/entities/book";

interface RecommendationSlotProps {
  title: string;
  books: BookSummary[];
  emptyMessage?: string;
  action?: React.ReactNode;
}

export const RecommendationSlot: React.FC<RecommendationSlotProps> = ({ title, books, emptyMessage = "暂无可展示的数据。", action }) => (
  <section className="mx-auto mt-9 max-w-[1320px] px-8 max-sm:px-4">
    <div className="mb-[18px] flex items-center justify-between gap-3">
      <h2 className="font-display text-[22px]">{title}</h2>
      {action}
    </div>
    {books.length > 0 ? (
      <BookGrid books={books} compact />
    ) : (
      <div className="app-card p-6 text-sm text-[var(--text-light)]">{emptyMessage}</div>
    )}
  </section>
);
