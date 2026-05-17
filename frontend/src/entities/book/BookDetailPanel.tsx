import React from "react";
import { BookOpen, Clock, CopyPlus, Play, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppLink } from "@/shared/ui/AppLink";
import { type BookDetail } from "./types";

interface BookDetailPanelProps {
  book: BookDetail;
  onStartSimilar?: () => void;
}

export const BookDetailPanel: React.FC<BookDetailPanelProps> = ({ book, onStartSimilar }) => {
  const durationMinutes = Math.max(1, Math.round(book.duration_seconds / 60));

  return (
    <section className="mx-auto grid max-w-[1320px] grid-cols-[minmax(260px,380px)_1fr] gap-8 px-8 py-8 max-md:grid-cols-1 max-sm:px-4">
      <div className="overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-soft)]">
        {book.cover_url ? (
          <img className="aspect-[3/4] w-full object-cover" src={book.cover_url} alt="" />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-[linear-gradient(135deg,var(--sage),var(--sky))] px-8 text-center">
            <span className="font-display text-5xl leading-tight text-white">{book.title}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-center">
        <span className="mb-3 inline-flex w-fit rounded-full bg-[rgba(94,160,122,0.12)] px-3 py-1 text-xs font-bold text-[var(--sage-deep)]">
          {book.access_level === "vip" ? "会员精选" : "免费可读"}
        </span>
        <h1 className="font-display text-4xl leading-tight max-sm:text-3xl">{book.title}</h1>
        {book.subtitle ? <p className="mt-2 text-lg text-[var(--text-mid)]">{book.subtitle}</p> : null}
        <p className="mt-5 max-w-2xl text-[15px] text-[var(--text-mid)]">{book.summary}</p>

        <div className="mt-6 grid max-w-2xl grid-cols-3 gap-3 max-sm:grid-cols-1">
          <Info icon={<BookOpen className="h-4 w-4" />} label={`${book.page_count} 页`} />
          <Info icon={<Clock className="h-4 w-4" />} label={`${durationMinutes} 分钟`} />
          <Info icon={<ShieldCheck className="h-4 w-4" />} label={book.language === "bilingual" ? "中英双语" : "单语阅读"} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {book.tags.map((tag) => (
            <span key={tag} className="rounded-xl bg-white px-3 py-1 text-xs font-semibold text-[var(--text-mid)] shadow-[var(--shadow-soft)]">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <AppLink to="/player">
              <Play className="h-4 w-4" />
              开始阅读
            </AppLink>
          </Button>
          <Button size="lg" variant="sage" onClick={onStartSimilar}>
            <CopyPlus className="h-4 w-4" />
            创建类似作品
          </Button>
        </div>
      </div>
    </section>
  );
};

const Info: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[var(--text-mid)] shadow-[var(--shadow-soft)]">
    {icon}
    {label}
  </span>
);
