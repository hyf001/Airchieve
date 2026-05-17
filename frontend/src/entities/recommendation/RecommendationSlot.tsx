import React from "react";

import { BookGrid, type BookSummary } from "@/entities/book";

interface RecommendationSlotProps {
  title: string;
  books: BookSummary[];
  action?: React.ReactNode;
}

export const RecommendationSlot: React.FC<RecommendationSlotProps> = ({ title, books, action }) => (
  <section className="mx-auto mt-9 max-w-[1320px] px-8 max-sm:px-4">
    <div className="mb-[18px] flex items-center justify-between gap-3">
      <h2 className="font-display text-[22px]">{title}</h2>
      {action}
    </div>
    <BookGrid books={books} compact />
  </section>
);
