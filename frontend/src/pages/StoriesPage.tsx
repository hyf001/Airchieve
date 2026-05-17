import React, { useEffect, useMemo, useState } from "react";

import { StoryCard, StoryEditor, type StoryPayload, type StorySummary } from "@/entities/story";
import { demoStories, storyLibraryApi } from "@/features/story-library";
import { useRouter } from "@/app/router";
import { AppShell } from "@/shared/layout/AppShell";

type StoryTab = "all" | "system" | "user";

export const StoriesPage: React.FC = () => {
  const { navigate } = useRouter();
  const [stories, setStories] = useState<StorySummary[]>(demoStories);
  const [tab, setTab] = useState<StoryTab>("all");
  const [activeStory, setActiveStory] = useState<StorySummary | null>(demoStories[0]);

  useEffect(() => {
    storyLibraryApi
      .listStories()
      .then((response) => {
        if (response.items.length > 0) {
          setStories(response.items);
          setActiveStory(response.items[0]);
        }
      })
      .catch(() => undefined);
  }, []);

  const visibleStories = useMemo(
    () => stories.filter((story) => tab === "all" || (tab === "system" ? story.source_type === "system" : story.source_type !== "system")),
    [stories, tab],
  );

  const handleCreateStory = async (payload: StoryPayload) => {
    try {
      const created = await storyLibraryApi.createStory(payload);
      setStories((current) => [created, ...current]);
      setActiveStory(created);
    } catch {
      const fallback: StorySummary = {
        id: Date.now(),
        owner_user_id: 1,
        source_type: "uploaded",
        title: payload.title,
        summary: payload.summary,
        cover_url: null,
        age_range_ids: payload.age_range_ids ?? [],
        theme_ids: payload.theme_ids ?? [],
        education_goal_ids: payload.education_goal_ids ?? [],
        language: payload.language ?? "zh",
        access_level: "free",
        publish_status: "published",
        view_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setStories((current) => [fallback, ...current]);
      setActiveStory(fallback);
    }
  };

  const handleStartCreation = async (story: StorySummary) => {
    try {
      await storyLibraryApi.startCreation(story.id);
    } catch {
      // 创作模块负责后续登录和权益；故事库只发起入口。
    } finally {
      navigate("/create");
    }
  };

  return (
    <AppShell>
      <main className="mx-auto grid max-w-[1320px] grid-cols-[1fr_360px] gap-6 px-8 py-8 max-lg:grid-cols-1 max-sm:px-4">
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-4xl">故事库</h1>
              <p className="mt-2 text-sm text-[var(--text-light)]">故事是纯文本资产，可保存、上传、筛选，并从这里发起绘本生成。</p>
            </div>
            <div className="flex rounded-[var(--radius-sm)] bg-white p-1 shadow-[var(--shadow-soft)]">
              {[
                ["all", "全部"],
                ["system", "系统故事"],
                ["user", "我的故事"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === value ? "bg-[var(--terracotta)] text-white" : "text-[var(--text-mid)]"}`}
                  onClick={() => setTab(value as StoryTab)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
            {visibleStories.map((story) => (
              <StoryCard key={story.id} story={story} onOpen={setActiveStory} onStartCreation={handleStartCreation} />
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <StoryEditor onSubmit={handleCreateStory} />
          {activeStory ? (
            <section className="app-card p-5">
              <h2 className="font-display text-2xl">{activeStory.title}</h2>
              <p className="mt-3 text-sm text-[var(--text-mid)]">{activeStory.summary}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Info label="来源" value={activeStory.source_type === "system" ? "系统故事" : "我的故事"} />
                <Info label="权益" value={activeStory.access_level === "vip" ? "VIP" : "免费"} />
                <Info label="语言" value={activeStory.language === "bilingual" ? "双语" : activeStory.language === "en" ? "英文" : "中文"} />
                <Info label="浏览" value={`${activeStory.view_count}`} />
              </dl>
            </section>
          ) : null}
        </aside>
      </main>
    </AppShell>
  );
};

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-[rgba(212,114,92,0.06)] px-3 py-2">
    <dt className="text-xs text-[var(--text-light)]">{label}</dt>
    <dd className="font-semibold text-[var(--text-mid)]">{value}</dd>
  </div>
);
