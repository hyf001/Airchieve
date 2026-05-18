import React from "react";

import { useRouter } from "@/app/router";
import { Button } from "@/components/ui/button";
import { BookPlayer, bookPlayerApi } from "@/features/book-player";
import { useProfiles } from "@/features/profile-management";
import { type BookPlayerPayload } from "@/entities/book";
import { AppShell } from "@/shared/layout/AppShell";
import { LoadingSpinner } from "@/shared/ui/loading";

export const PlayerPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentProfile } = useProfiles();
  const [payload, setPayload] = React.useState<BookPlayerPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const queryBookId = Number(new URLSearchParams(window.location.search).get("bookId"));
    const storedBookId = Number(window.sessionStorage.getItem("airchieve.current_book_id"));
    const bookId = Number.isFinite(queryBookId) && queryBookId > 0 ? queryBookId : storedBookId;
    if (!Number.isFinite(bookId) || bookId <= 0) {
      setError("缺少有效的绘本 ID，无法打开播放器。");
      return;
    }
    bookPlayerApi
      .getPlayerPayload(bookId, { childProfileId: currentProfile?.id ?? null })
      .then((response) => {
        setPayload(response);
        setError(null);
      })
      .catch((requestError) => {
        setPayload(null);
        setError(requestError instanceof Error ? requestError.message : "播放器加载失败");
      });
  }, [currentProfile?.id]);

  if (error) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[1320px] px-8 py-10 max-sm:px-4">
          <section className="app-card p-8">
            <p className="text-sm text-[var(--text-mid)]">{error}</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/book-detail")}>
              返回绘本详情
            </Button>
          </section>
        </main>
      </AppShell>
    );
  }

  if (!payload) {
    return (
      <AppShell>
        <main className="flex min-h-[360px] items-center justify-center">
          <LoadingSpinner label="正在加载播放器" />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BookPlayer payload={payload} />
    </AppShell>
  );
};
