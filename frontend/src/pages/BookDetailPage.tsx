import React, { useEffect, useState } from "react";

import { BookDetailPanel, BookGrid, type BookDetail } from "@/entities/book";
import { discoveryApi } from "@/features/discovery";
import { FavoriteButton } from "@/features/reading";
import { useProfiles } from "@/features/profile-management";
import { AppShell } from "@/shared/layout/AppShell";
import { useRouter } from "@/app/router";
import { LoadingSpinner } from "@/shared/ui/loading";

export const BookDetailPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentProfile } = useProfiles();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bookId = Number(new URLSearchParams(window.location.search).get("bookId"));
    if (!Number.isFinite(bookId) || bookId <= 0) {
      setError("缺少有效的绘本 ID，无法加载绘本详情。");
      return;
    }

    discoveryApi
      .getBook(bookId)
      .then((response) => {
        setBook(response);
        setError(null);
      })
      .catch((requestError) => {
        setBook(null);
        setError(requestError instanceof Error ? requestError.message : "绘本详情加载失败");
      });
  }, []);

  if (error) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[1320px] px-8 py-10 max-sm:px-4">
          <section className="app-card p-8 text-sm text-[var(--text-mid)]">{error}</section>
        </main>
      </AppShell>
    );
  }

  if (!book) {
    return (
      <AppShell>
        <main className="flex min-h-[360px] items-center justify-center">
          <LoadingSpinner label="正在加载绘本详情" />
        </main>
      </AppShell>
    );
  }

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
      <BookDetailPanel
        book={book}
        onStartReading={() => {
          window.sessionStorage.setItem("airchieve.current_book_id", String(book.id));
          navigate("/player");
        }}
        onStartSimilar={handleStartSimilar}
      />
      <div className="mx-auto max-w-[1320px] px-8 max-sm:px-4">
        <FavoriteButton bookId={book.id} childProfileId={currentProfile?.id ?? null} />
      </div>
      {message ? (
        <div className="mx-auto max-w-[1320px] px-8 max-sm:px-4">
          <div className="rounded-[var(--radius-md)] bg-[rgba(94,160,122,0.12)] px-4 py-3 text-sm font-semibold text-[var(--sage-deep)]">
            {message}
          </div>
        </div>
      ) : null}
      <section className="mx-auto mt-6 max-w-[1320px] px-8 pb-10 max-sm:px-4">
        <h2 className="font-display mb-4 text-2xl">相关绘本</h2>
        {book.related_books.length > 0 ? (
          <BookGrid books={book.related_books} compact />
        ) : (
          <div className="app-card p-6 text-sm text-[var(--text-light)]">暂无相关绘本。</div>
        )}
      </section>
    </AppShell>
  );
};
