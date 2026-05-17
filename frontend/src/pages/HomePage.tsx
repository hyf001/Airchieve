import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, PenLine, Search, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookGrid, type BookSummary } from "@/entities/book";
import { RecommendationSlot } from "@/entities/recommendation";
import { demoBooks, discoveryApi } from "@/features/discovery";
import { useAuth } from "@/features/auth";
import { AppShell } from "@/shared/layout/AppShell";
import { AppLink } from "@/shared/ui/AppLink";

const scenes = ["睡前", "亲子共读", "课堂播放", "情绪引导", "习惯养成", "英语启蒙"];

export const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [books, setBooks] = useState<BookSummary[]>(demoBooks);
  const [query, setQuery] = useState("");
  const [activeScene, setActiveScene] = useState("全部");

  useEffect(() => {
    discoveryApi
      .listBooks({ sort: "featured", limit: 12 })
      .then((response) => {
        if (response.items.length > 0) setBooks(response.items);
      })
      .catch(() => undefined);
  }, []);

  const filteredBooks = useMemo(() => {
    const value = query.trim().toLowerCase();
    return books.filter((book) => {
      const matchesQuery = !value || book.title.toLowerCase().includes(value) || book.tags.some((tag) => tag.includes(query));
      const matchesScene = activeScene === "全部" || book.tags.includes(activeScene.replace("亲子共读", "亲子"));
      return matchesQuery && matchesScene;
    });
  }, [activeScene, books, query]);

  return (
    <AppShell>
      <section className="mx-auto grid max-w-[1320px] grid-cols-[1.1fr_0.9fr] gap-8 px-8 py-8 max-lg:grid-cols-1 max-sm:px-4">
        <div className="flex min-h-[360px] flex-col justify-center rounded-[var(--radius-xl)] bg-[linear-gradient(135deg,#FAD2C4,#FFE7A8_48%,#BFE6CF)] p-10 shadow-[var(--shadow-soft)] max-sm:p-6">
          <span className="mb-4 inline-flex w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[var(--terracotta)]">
            {isAuthenticated ? "已为当前档案准备推荐" : "免费试看与精选内容"}
          </span>
          <h1 className="font-display max-w-2xl text-5xl leading-tight max-sm:text-3xl">找到今晚适合孩子打开的绘本</h1>
          <p className="mt-4 max-w-xl text-[15px] text-[var(--text-mid)]">
            搜索绘本、按场景挑选，也可以从故事或模板开始创建。儿童阅读区保持清爽，不放购买打扰。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <AppLink to="/player">
                <BookOpen className="h-4 w-4" />
                开始阅读
              </AppLink>
            </Button>
            <Button asChild size="lg" variant="sage">
              <AppLink to="/create">
                <PenLine className="h-4 w-4" />
                创建绘本
              </AppLink>
            </Button>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="app-card p-5">
            <h2 className="font-display text-2xl">继续阅读</h2>
            {books.slice(0, 3).map((book, index) => (
              <AppLink key={book.id} to="/player" className="mt-4 flex items-center gap-3 text-inherit no-underline">
                <span className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-sm)] bg-[rgba(126,200,227,0.16)] font-bold text-[var(--sky-deep)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{book.title}</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[rgba(212,114,92,0.12)]">
                    <span className="block h-full rounded-full bg-[var(--terracotta)]" style={{ width: `${38 + index * 18}%` }} />
                  </span>
                </span>
              </AppLink>
            ))}
          </div>
          <div className="app-card flex items-start gap-3 p-5">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[var(--sage-deep)]" />
            <p className="text-sm text-[var(--text-mid)]">无第三方广告，个人故事和素材默认私密，分享前会进入隐私确认流程。</p>
          </div>
        </aside>
      </section>

      <section className="mx-auto max-w-[1320px] px-8 max-sm:px-4">
        <div className="app-card flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[260px] flex-1">
            <input
              className="h-11 w-full rounded-[22px] border-2 border-[rgba(212,114,92,0.15)] bg-white px-4 pr-11 text-sm outline-none focus:border-[var(--peach)]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、主题、教育目标..."
              type="search"
            />
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
          </div>
          {["全部", ...scenes].map((scene) => (
            <button
              key={scene}
              className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${
                scene === activeScene ? "bg-[var(--terracotta)] text-white" : "bg-[rgba(212,114,92,0.08)] text-[var(--text-mid)]"
              }`}
              onClick={() => setActiveScene(scene)}
            >
              {scene}
            </button>
          ))}
        </div>
      </section>

      <RecommendationSlot
        title="精选绘本"
        books={filteredBooks}
        action={
          <AppLink to="/stories" className="text-sm font-semibold text-[var(--terracotta)] no-underline">
            从故事开始
          </AppLink>
        }
      />

      <section className="mx-auto mt-9 max-w-[1320px] px-8 max-sm:px-4">
        <div className="mb-[18px] flex items-center justify-between">
          <h2 className="font-display text-[22px]">新上架与热门播放</h2>
          <AppLink to="/stories" className="text-sm font-semibold text-[var(--text-light)] no-underline">
            进入故事库
          </AppLink>
        </div>
        <BookGrid books={[...books].sort((a, b) => b.play_count - a.play_count).slice(0, 5)} compact />
      </section>

      <section className="mx-auto mt-9 grid max-w-[1320px] grid-cols-4 gap-4 px-8 pb-10 max-md:grid-cols-2 max-sm:px-4">
        {["从一个想法开始", "从系统故事开始", "从我的故事开始", "从绘本模板开始"].map((label) => (
          <AppLink key={label} to="/create" className="app-card app-card-hover p-5 text-center text-inherit no-underline">
            <span className="font-display block text-xl">{label}</span>
            <span className="mt-2 block text-xs text-[var(--text-light)]">进入创作流程</span>
          </AppLink>
        ))}
      </section>
    </AppShell>
  );
};
