import React from "react";
import { Clock, Crown, Play } from "lucide-react";

import { type AppRoute } from "@/app/router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppLink } from "@/shared/ui/AppLink";
import { type BookSummary } from "./types";

const languageText: Record<BookSummary["language"], string> = {
  zh: "中文",
  en: "英文",
  bilingual: "双语",
};

const coverClassNames = [
  "from-[#FAD2C4] to-[#EF7B67]",
  "from-[#BFE6CF] to-[#56A77A]",
  "from-[#B9DDF1] to-[#4BA3C7]",
  "from-[#FFE7A8] to-[#F2A83B]",
  "from-[#D9C7EE] to-[#8D6CC7]",
];

interface BookCardProps {
  book: BookSummary;
  to?: AppRoute;
  compact?: boolean;
}

export const BookCard: React.FC<BookCardProps> = ({ book, to = "/book-detail", compact = false }) => {
  const durationMinutes = Math.max(1, Math.round(book.duration_seconds / 60));
  const coverClassName = coverClassNames[book.id % coverClassNames.length];

  return (
    <article className="app-card app-card-hover overflow-hidden">
      <AppLink to={to} className="block text-inherit no-underline" aria-label={`查看绘本 ${book.title}`}>
        {book.cover_url ? (
          <img className="aspect-[3/4] w-full object-cover" src={book.cover_url} alt="" />
        ) : (
          <span className={cn("flex aspect-[3/4] items-center justify-center bg-gradient-to-br px-5 text-center", coverClassName)}>
            <span className="font-display text-3xl leading-tight text-white drop-shadow-sm">{book.title.slice(0, 6)}</span>
          </span>
        )}
      </AppLink>
      <div className={cn("space-y-2 p-3.5", compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5">{book.title}</h3>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-white",
              book.access_level === "vip" ? "bg-[var(--honey)]" : "bg-[var(--sage-deep)]",
            )}
          >
            {book.access_level === "vip" && <Crown className="h-3 w-3" />}
            {book.access_level === "vip" ? "VIP" : "免费"}
          </span>
        </div>
        {!compact && book.summary ? <p className="line-clamp-2 text-xs text-[var(--text-light)]">{book.summary}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {[languageText[book.language], ...book.tags.slice(0, 2)].map((tag) => (
            <span key={tag} className="rounded-lg bg-[rgba(212,114,92,0.08)] px-2 py-0.5 text-[11px] text-[var(--text-mid)]">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-[var(--text-light)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {durationMinutes} 分钟
          </span>
          <Button asChild size="sm" variant="ghost" className="h-8 px-2">
            <AppLink to="/player" aria-label={`播放 ${book.title}`}>
              <Play className="h-3.5 w-3.5" />
              播放
            </AppLink>
          </Button>
        </div>
      </div>
    </article>
  );
};
