import React from "react";

import { type BookSummary } from "./types";
import { BookCard } from "./BookCard";

interface BookGridProps {
  books: BookSummary[];
  compact?: boolean;
}

export const BookGrid: React.FC<BookGridProps> = ({ books, compact = false }) => (
  <div className="grid grid-cols-5 gap-[18px] max-lg:grid-cols-4 max-md:grid-cols-2 max-sm:gap-3">
    {books.map((book) => (
      <BookCard key={book.id} book={book} compact={compact} />
    ))}
  </div>
);
