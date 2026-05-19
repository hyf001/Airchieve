import React from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReadonlyBookPlayer } from "@/features/book-player";
import { shareApi } from "@/features/share";
import { type BookPlayerPayload } from "@/entities/book";
import { AppShell } from "@/shared/layout/AppShell";
import { LoadingSpinner } from "@/shared/ui/loading";

const readToken = () => {
  const prefix = "/share/public/";
  const path = window.location.pathname;
  return path.startsWith(prefix) ? decodeURIComponent(path.slice(prefix.length)) : "";
};

export const PublicSharePage: React.FC = () => {
  const [password, setPassword] = React.useState("");
  const [payload, setPayload] = React.useState<(BookPlayerPayload & { share?: unknown }) | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [passwordRequired, setPasswordRequired] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const token = React.useMemo(readToken, []);

  const load = React.useCallback(
    async (nextPassword?: string) => {
      if (!token) {
        setError("分享链接无效。");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await shareApi.getPublicPlayer(token, nextPassword);
        setPayload(response);
        setPasswordRequired(false);
        setError(null);
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "分享内容加载失败";
        setPayload(null);
        setError(message);
        setPasswordRequired(message.includes("密码"));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <AppShell>
        <main className="flex min-h-[360px] items-center justify-center">
          <LoadingSpinner label="正在打开分享绘本" />
        </main>
      </AppShell>
    );
  }

  if (passwordRequired) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[520px] px-4 py-12">
          <section className="app-card p-6">
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5 text-[var(--terracotta)]" />
              <h1 className="font-display text-2xl">输入访问密码</h1>
            </div>
            <p className="mt-2 text-sm text-[var(--text-light)]">这个分享链接需要创建者提供的密码。</p>
            <form
              className="mt-4 flex gap-2 max-sm:flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                void load(password);
              }}
            >
              <input
                className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button type="submit">打开</Button>
            </form>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </section>
        </main>
      </AppShell>
    );
  }

  if (error || !payload) {
    return (
      <AppShell>
        <main className="mx-auto max-w-[720px] px-4 py-12">
          <section className="app-card p-6 text-sm text-[var(--text-mid)]">{error ?? "分享内容不存在。"}</section>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ReadonlyBookPlayer payload={payload} />
    </AppShell>
  );
};
