import React, { useEffect, useState } from "react";

import { BookDetailPanel, BookGrid, type BookDetail } from "@/entities/book";
import { demoBookDetail, discoveryApi } from "@/features/discovery";
import { AppShell } from "@/shared/layout/AppShell";
import { useRouter } from "@/app/router";

export const BookDetailPage: React.FC = () => {
  const { navigate } = useRouter();
  const [book, setBook] = useState<BookDetail>(demoBookDetail);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const bookId = Number(new URLSearchParams(window.location.search).get("bookId") ?? demoBookDetail.id);
    discoveryApi
      .getBook(Number.isFinite(bookId) ? bookId : demoBookDetail.id)
      .then(setBook)
      .catch(() => undefined);
  }, []);

  const handleStartSimilar = async () => {
    setMessage(null);
    try {
      const response = await discoveryApi.startSimilarCreation(book.id);
      setMessage(response.guidance);
    } catch {
      setMessage("已进入创作入口；若需要保存会话，请先登录。");
    } finally {
      window.setTimeout(() => navigate("/create"), 650);
    }
  };

  return (
    <AppShell>
      <BookDetailPanel book={book} onStartSimilar={handleStartSimilar} />
      {message ? (
        <div className="mx-auto max-w-[1320px] px-8 max-sm:px-4">
          <div className="rounded-[var(--radius-md)] bg-[rgba(94,160,122,0.12)] px-4 py-3 text-sm font-semibold text-[var(--sage-deep)]">
            {message}
          </div>
        </div>
      ) : null}
      <section className="mx-auto mt-6 max-w-[1320px] px-8 pb-10 max-sm:px-4">
        <h2 className="font-display mb-4 text-2xl">相关绘本</h2>
        <BookGrid books={book.related_books.length ? book.related_books : demoBookDetail.related_books} compact />
      </section>
    </AppShell>
  );
};
