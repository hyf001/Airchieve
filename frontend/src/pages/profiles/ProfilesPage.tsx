import React from "react";
import { BookCopy, BookOpen, Clock, Eye, Heart, History, LibraryBig, Palette, Plus, RotateCw, Trash2, UserRound, Volume2, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountSummary } from "@/entities/account";
import { type BookSummary } from "@/entities/book";
import { ChildProfileCard } from "@/entities/child-profile";
import { useTaxonomyGroup } from "@/entities/taxonomy/useTaxonomyGroup";
import { RequireAuth } from "@/features/auth";
import { creationApi, type CreationSession } from "@/features/creation";
import { discoveryApi } from "@/features/discovery";
import {
  useProfiles,
  type ChildProfile,
  type ChildProfileEducationGoal,
  type ChildProfileInterestTag,
  type ChildProfilePayload,
} from "@/features/profile-management";
import { readingApi, type RecentReadSummary } from "@/features/reading";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { LoadingSpinner } from "@/shared/ui/loading";
import { Modal } from "@/shared/ui/modal";

const emptyPayload: ChildProfilePayload = {
  nickname: "",
  age_range: null,
  reading_level: null,
  interest_tags: [],
  education_goals: [],
  default_character: null,
  default_voice: null,
  default_art_style: null,
};

interface ProfileActivityState {
  recentReads: RecentReadSummary[];
  favoriteBooks: BookSummary[];
  creationSessions: CreationSession[];
  isLoading: boolean;
  error: string | null;
}

const emptyActivityState: ProfileActivityState = {
  recentReads: [],
  favoriteBooks: [],
  creationSessions: [],
  isLoading: false,
  error: null,
};

interface AccountActivityState {
  personalBooks: BookSummary[];
  creationSessions: CreationSession[];
  isLoading: boolean;
  error: string | null;
}

const emptyAccountActivityState: AccountActivityState = {
  personalBooks: [],
  creationSessions: [],
  isLoading: false,
  error: null,
};

export const ProfilesPage: React.FC = () => (
  <AppShell hideSearch>
    <RequireAuth>
      <ProfilesContent />
    </RequireAuth>
  </AppShell>
);

const ProfilesContent: React.FC = () => {
  const {
    profiles,
    currentProfile,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    setCurrentProfile,
  } = useProfiles();
  const [editingProfile, setEditingProfile] = React.useState<ChildProfile | null>(null);
  const [detailProfile, setDetailProfile] = React.useState<ChildProfile | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"children" | "content">("children");
  const [accountActivity, setAccountActivity] = React.useState<AccountActivityState>(emptyAccountActivityState);
  const activeDetail = detailProfile ?? currentProfile;

  const handleDuplicateSession = async (sessionId: number) => {
    const duplicated = await creationApi.duplicateSession(sessionId);
    setAccountActivity((current) => ({
      ...current,
      creationSessions: [duplicated, ...current.creationSessions.filter((session) => session.id !== duplicated.id)],
    }));
    window.location.href = creationSessionHref(duplicated.id);
  };

  React.useEffect(() => {
    let ignore = false;
    setAccountActivity((current) => ({ ...current, isLoading: true, error: null }));

    const loadAccountActivity = async () => {
      const [personalBooks, creationSessions] = await Promise.allSettled([
        discoveryApi.listMyBooks(8),
        creationApi.listSessions(null, 8),
      ]);
      if (ignore) return;
      const firstError = [personalBooks, creationSessions].find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      setAccountActivity({
        personalBooks: personalBooks.status === "fulfilled" ? personalBooks.value.items : [],
        creationSessions: creationSessions.status === "fulfilled" ? creationSessions.value : [],
        isLoading: false,
        error: firstError ? "账号内容暂时加载失败，请稍后重试。" : null,
      });
    };

    void loadAccountActivity();
    return () => {
      ignore = true;
    };
  }, []);

  const handleAddProfile = () => {
    setEditingProfile(null);
    setModalOpen(true);
  };

  const handleEditProfile = (profile: ChildProfile) => {
    setEditingProfile(profile);
    setModalOpen(true);
  };

  const handleSaveProfile = async (payload: ChildProfilePayload) => {
    if (editingProfile) {
      await updateProfile(editingProfile.id, payload);
    } else {
      await createProfile(payload);
    }
    setModalOpen(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = async (profile: ChildProfile) => {
    await deleteProfile(profile.id);
    setDetailProfile(null);
  };

  return (
    <main>
      <header className="mx-auto flex max-w-[1320px] items-end justify-between gap-6 px-8 pb-6 pt-12 max-md:flex-col max-md:items-start max-sm:px-4">
        <div>
          <h1 className="font-display mb-2 flex items-center gap-3 text-[36px] max-sm:text-[29px]">
            <UserRound className="h-8 w-8 text-[var(--terracotta)]" />
            我的孩子档案
          </h1>
          <p className="text-[15px] text-[var(--text-light)]">为每个孩子创建专属阅读档案，定制个性化绘本体验</p>
        </div>
        <Button size="lg" onClick={handleAddProfile}>
          <Plus className="h-5 w-5" />
          添加档案
        </Button>
      </header>

      <section className="mx-auto max-w-[1320px] px-8 pb-10 max-sm:px-4">
        <div className="mb-7 inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white/80 p-1 shadow-[0_10px_30px_rgba(92,55,42,0.08)] backdrop-blur">
          <ProfileTabButton
            active={activeTab === "children"}
            icon={<UserRound className="h-4 w-4" />}
            label="孩子档案"
            onClick={() => setActiveTab("children")}
          />
          <ProfileTabButton
            active={activeTab === "content"}
            icon={<LibraryBig className="h-4 w-4" />}
            label="我的内容"
            onClick={() => setActiveTab("content")}
          />
        </div>

        {activeTab === "children" ? (
          <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(360px,0.55fr)] gap-7 max-xl:grid-cols-1">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">孩子档案</h2>
                  <p className="mt-1 text-sm text-[var(--text-light)]">阅读进度、收藏和孩子专属创作会按档案分开记录。</p>
                </div>
              </div>
              {error ? (
                <div className="mb-5 rounded-[var(--radius-md)] border border-[rgba(245,166,35,0.22)] bg-[rgba(245,166,35,0.08)] px-4 py-3 text-sm text-[var(--text-mid)]">
                  {error}
                </div>
              ) : null}

              {isLoading ? (
                <div className="flex min-h-[280px] items-center justify-center">
                  <LoadingSpinner label="正在加载儿童档案" />
                </div>
              ) : profiles.length > 0 ? (
                <div className="grid grid-cols-3 gap-7 max-xl:grid-cols-2 max-md:grid-cols-1">
                  {profiles.map((profile) => (
                    <ChildProfileCard
                      key={profile.id}
                      profile={profile}
                      onEdit={handleEditProfile}
                      onOpenDetail={setDetailProfile}
                      onSelect={(item) => void setCurrentProfile(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <section className="app-card p-8 text-center">
                  <h2 className="font-display mb-2 text-2xl">还没有儿童档案</h2>
                  <p className="mb-6 text-sm text-[var(--text-light)]">添加第一个孩子档案后，首页推荐和创建流程会使用这份默认配置。</p>
                  <Button onClick={handleAddProfile}>
                    <Plus className="h-4 w-4" />
                    添加档案
                  </Button>
                </section>
              )}
            </section>

            <aside className="space-y-5">
              <AccountSummary />
              <CurrentProfileSummary profile={currentProfile} />
            </aside>
          </div>
        ) : (
          <AccountContentPanel activity={accountActivity} onDuplicateSession={handleDuplicateSession} />
        )}
      </section>

      {activeTab === "children" && activeDetail ? (
        <ProfileDetailPanel
          profile={activeDetail}
          onClose={() => setDetailProfile(null)}
          onDelete={handleDeleteProfile}
          onEdit={handleEditProfile}
        />
      ) : null}

      <ProfileFormModal
        open={modalOpen}
        profile={editingProfile}
        onClose={() => setModalOpen(false)}
        onSubmit={(payload) => void handleSaveProfile(payload).catch(() => undefined)}
      />
    </main>
  );
};

const ProfileTabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    className={cn(
      "inline-flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-all focus:outline-none focus:ring-4 focus:ring-[rgba(245,166,35,0.16)] max-sm:min-w-0 max-sm:px-4",
      active
        ? "bg-[linear-gradient(135deg,var(--honey),var(--peach))] text-white shadow-[0_8px_18px_rgba(239,123,103,0.28)]"
        : "text-[var(--text-mid)] hover:bg-[rgba(245,166,35,0.08)] hover:text-[var(--terracotta)]",
    )}
    type="button"
    aria-pressed={active}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const CurrentProfileSummary: React.FC<{ profile: ChildProfile | null }> = ({ profile }) => {
  const { labelMap: ageLabels } = useTaxonomyGroup("age_range");
  const { labelMap: readingLabels } = useTaxonomyGroup("reading_level");
  const { items: interestItems } = useTaxonomyGroup("interest_tag");

  if (!profile) {
    return (
      <section className="app-card p-6">
        <h2 className="font-display mb-3 text-xl">当前儿童档案</h2>
        <p className="text-sm text-[var(--text-light)]">暂无当前档案</p>
      </section>
    );
  }

  const ageLabel = profile.age_range ? ageLabels[profile.age_range] ?? profile.age_range_label : undefined;
  const readingLabel = profile.reading_level ? readingLabels[profile.reading_level] ?? profile.reading_level_label : undefined;
  const interestLabel = profile.interest_tags
    .map((code) => interestItems.find((item) => item.code === code)?.name ?? code)
    .join("、");

  return (
    <section className="app-card p-6">
      <h2 className="font-display mb-3 text-xl">当前儿童档案</h2>
      <div className="space-y-3 text-sm text-[var(--text-mid)]">
        <strong className="block text-lg text-[var(--text-dark)]">{profile.nickname}</strong>
        <p>年龄：{ageLabel ?? profile.age_range_label ?? "未设置"}</p>
        <p>阅读：{readingLabel ?? profile.reading_level_label ?? "未设置"}</p>
        <p>兴趣：{interestLabel || "未设置"}</p>
      </div>
    </section>
  );
};

const AccountContentPanel: React.FC<{ activity: AccountActivityState; onDuplicateSession: (sessionId: number) => Promise<void> }> = ({
  activity,
  onDuplicateSession,
}) => {
  const [activeContentTab, setActiveContentTab] = React.useState<"books" | "sessions">("books");

  return (
    <section className="app-card p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl">我的内容</h2>
          <p className="mt-1 text-xs text-[var(--text-light)]">账号维度的创作成果与创作流水</p>
        </div>
        <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-[var(--cream)] p-1">
          <ContentTabButton
            active={activeContentTab === "books"}
            icon={<LibraryBig className="h-4 w-4" />}
            label="我的绘本"
            onClick={() => setActiveContentTab("books")}
          />
          <ContentTabButton
            active={activeContentTab === "sessions"}
            icon={<History className="h-4 w-4" />}
            label="创作记录"
            onClick={() => setActiveContentTab("sessions")}
          />
        </div>
      </div>

      {activeContentTab === "books" ? (
        <DetailSection icon={<LibraryBig className="h-5 w-5" />} title="我的绘本">
          {activity.isLoading ? (
            <LoadingSpinner label="正在加载我的绘本" />
          ) : (
            <BookMiniList books={activity.personalBooks} emptyMessage="保存后的创作成果会出现在这里。" compact />
          )}
        </DetailSection>
      ) : (
        <DetailSection icon={<History className="h-5 w-5" />} title="创作记录">
          <CreationSessionList sessions={activity.creationSessions} isLoading={activity.isLoading} onDuplicateSession={onDuplicateSession} />
        </DetailSection>
      )}

      {activity.error ? <p className="text-xs text-[var(--terracotta)]">{activity.error}</p> : null}
    </section>
  );
};

const ContentTabButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    className={cn(
      "inline-flex h-9 min-w-[104px] items-center justify-center gap-2 rounded-full px-4 text-xs font-bold transition focus:outline-none focus:ring-4 focus:ring-[rgba(245,166,35,0.14)] max-sm:min-w-0",
      active
        ? "bg-white text-[var(--terracotta)] shadow-[0_6px_16px_rgba(92,55,42,0.08)]"
        : "text-[var(--text-mid)] hover:bg-white/70 hover:text-[var(--terracotta)]",
    )}
    type="button"
    aria-pressed={active}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

const ProfileDetailPanel: React.FC<{
  profile: ChildProfile;
  onClose: () => void;
  onDelete: (profile: ChildProfile) => void;
  onEdit: (profile: ChildProfile) => void;
}> = ({ profile, onClose, onDelete, onEdit }) => {
  const [activity, setActivity] = React.useState<ProfileActivityState>(emptyActivityState);
  const { labelMap: ageLabels } = useTaxonomyGroup("age_range");
  const { items: interestItems } = useTaxonomyGroup("interest_tag");
  const { items: educationItems } = useTaxonomyGroup("education_goal");
  const { items: characterItems } = useTaxonomyGroup("asset_category");

  React.useEffect(() => {
    let ignore = false;
    setActivity((current) => ({ ...current, isLoading: true, error: null }));

    const loadActivity = async () => {
      const [recentReads, favoriteBooks, creationSessions] = await Promise.allSettled([
        readingApi.listRecent(profile.id, 4),
        readingApi.listFavorites(profile.id, 4),
        creationApi.listSessions(profile.id, 6),
      ]);
      if (ignore) return;
      const firstError = [recentReads, favoriteBooks, creationSessions].find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      setActivity({
        recentReads: recentReads.status === "fulfilled" ? recentReads.value : [],
        favoriteBooks: favoriteBooks.status === "fulfilled" ? favoriteBooks.value : [],
        creationSessions: creationSessions.status === "fulfilled" ? creationSessions.value : [],
        isLoading: false,
        error: firstError ? "部分记录暂时加载失败，请稍后重试。" : null,
      });
    };

    void loadActivity();
    return () => {
      ignore = true;
    };
  }, [profile.id]);

  const handleDuplicateSession = async (sessionId: number) => {
    const duplicated = await creationApi.duplicateSession(sessionId);
    setActivity((current) => ({
      ...current,
      creationSessions: [duplicated, ...current.creationSessions.filter((session) => session.id !== duplicated.id)],
    }));
    window.location.href = creationSessionHref(duplicated.id);
  };

  const ageLabel = profile.age_range ? ageLabels[profile.age_range] ?? profile.age_range_label : undefined;
  const characterLabel = characterItems.find((item) => item.code === profile.default_character)?.name ?? profile.default_character;
  const voiceLabel = profile.default_voice;
  const artStyleLabel = characterItems.find((item) => item.code === profile.default_art_style)?.name ?? profile.default_art_style;

  return (
    <section className="mx-auto max-w-[1320px] px-8 pb-16 max-sm:px-4">
      <div className="app-card overflow-hidden rounded-[var(--radius-xl)]">
        <header className="flex items-center justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] bg-[linear-gradient(135deg,#FFF8F0,#FFF0E5)] px-9 py-8 max-md:px-5">
          <div className="flex min-w-0 items-center gap-5">
            <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FFE082,var(--honey),var(--peach))] text-4xl shadow-[0_6px_24px_rgba(245,166,35,0.3)]">
              🌟
            </span>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-display truncate text-[28px]">{profile.nickname}</h2>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[var(--terracotta)]">
                  孩子档案
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-light)]">
                {ageLabel ?? profile.age_range_label ?? "未设置年龄"} · 阅读、收藏和孩子相关创作单独归档
              </p>
            </div>
          </div>
          <Button aria-label="关闭详情" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="grid grid-cols-[0.9fr_1.1fr] max-lg:grid-cols-1">
          <div className="border-r border-[rgba(212,114,92,0.08)] p-9 max-lg:border-b max-lg:border-r-0 max-md:p-5">
            <DetailSection icon={<Wand2 className="h-5 w-5" />} title="偏好配置">
              <TaxonomyTagList codes={profile.interest_tags} items={interestItems} />
              <TaxonomyTagList codes={profile.education_goals} items={educationItems} />
              <div className="mt-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
                <ResourceTile icon={<UserRound />} label="默认形象" value={characterLabel} />
                <ResourceTile icon={<Volume2 />} label="默认声音" value={voiceLabel} />
                <ResourceTile icon={<Palette />} label="默认画风" value={artStyleLabel} />
              </div>
            </DetailSection>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button onClick={() => onEdit(profile)}>编辑档案</Button>
              <Button variant="outline" onClick={() => onDelete(profile)}>
                <Trash2 className="h-4 w-4" />
                删除档案
              </Button>
            </div>
          </div>

          <div className="p-9 max-md:p-5">
            <div className="mb-5 rounded-[var(--radius-md)] border border-[rgba(94,160,122,0.16)] bg-[rgba(94,160,122,0.08)] px-4 py-3 text-xs font-semibold text-[var(--sage-deep)]">
              这里展示带有当前孩子档案 ID 的记录；账号级“个人绘本库”已移动到右侧“我的内容”。
            </div>

            <DetailSection icon={<BookOpen className="h-5 w-5" />} title="孩子阅读历史">
              <RecentReadList items={activity.recentReads} isLoading={activity.isLoading} />
            </DetailSection>

            <DetailSection icon={<Heart className="h-5 w-5" />} title="孩子收藏绘本">
              <BookMiniList books={activity.favoriteBooks} emptyMessage="当前没有可展示的收藏绘本。" />
            </DetailSection>

            <DetailSection icon={<History className="h-5 w-5" />} title="孩子相关创作">
              <CreationSessionList sessions={activity.creationSessions} isLoading={activity.isLoading} onDuplicateSession={handleDuplicateSession} />
            </DetailSection>
            {activity.error ? <p className="text-xs text-[var(--terracotta)]">{activity.error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
};

const DetailSection: React.FC<React.PropsWithChildren<{ icon: React.ReactNode; title: string }>> = ({ children, icon, title }) => (
  <section className="mb-7 last:mb-0">
    <h3 className="font-display mb-4 flex items-center gap-2 text-lg">
      <span className="text-[var(--terracotta)]">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const bookDetailHref = (bookId: number) => `/book-detail?bookId=${bookId}`;
const playerHref = (bookId: number) => `/player?bookId=${bookId}`;
const creationSessionHref = (sessionId: number) => `/create?sessionId=${sessionId}`;

const BookMiniList: React.FC<{ books: BookSummary[]; emptyMessage: string; compact?: boolean }> = ({ books, emptyMessage, compact = false }) => {
  if (books.length === 0) return <EmptyFactState message={emptyMessage} />;

  return (
    <div className="space-y-2.5">
      {books.map((book) => (
        <a
          key={book.id}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-3 text-inherit no-underline transition hover:border-[rgba(212,114,92,0.22)] hover:shadow-sm"
          href={bookDetailHref(book.id)}
        >
          {book.cover_url ? (
            <img className={cn("shrink-0 rounded-[10px] object-cover", compact ? "h-12 w-9" : "h-14 w-11")} src={book.cover_url} alt="" />
          ) : (
            <span className={cn("flex shrink-0 items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#FAD2C4,#EF7B67)] px-1 text-center text-[11px] font-bold leading-tight text-white", compact ? "h-12 w-9" : "h-14 w-11")}>
              {book.title.slice(0, 4)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[var(--text-dark)]">{book.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-light)]">
              <span>{book.page_count} 页</span>
              <span>{Math.max(1, Math.round(book.duration_seconds / 60))} 分钟</span>
            </span>
          </span>
        </a>
      ))}
    </div>
  );
};

const RecentReadList: React.FC<{ items: RecentReadSummary[]; isLoading: boolean }> = ({ items, isLoading }) => {
  if (isLoading) return <LoadingSpinner label="正在加载阅读记录" />;
  if (items.length === 0) return <EmptyFactState message="当前没有可展示的阅读历史。" />;

  return (
    <div className="space-y-2.5">
      {items.map(({ book, progress }) => (
        <a
          key={`${book.id}-${progress.id}`}
          className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-3 text-inherit no-underline transition hover:border-[rgba(212,114,92,0.22)] hover:shadow-sm"
          href={playerHref(book.id)}
          onClick={() => window.sessionStorage.setItem("airchieve.current_book_id", String(book.id))}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(94,160,122,0.12)] text-[var(--sage-deep)]">
            <Clock className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-[var(--text-dark)]">{book.title}</span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[rgba(212,114,92,0.08)]">
              <span className="block h-full rounded-full bg-[var(--sage-deep)]" style={{ width: `${progress.progress_percent}%` }} />
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-[var(--sage-deep)]">{Math.round(progress.progress_percent)}%</span>
        </a>
      ))}
    </div>
  );
};

const creationTypeLabels: Record<CreationSession["creation_type"], string> = {
  story_to_book: "故事生成",
  template_book: "模板创作",
  similar_book: "类似作品",
};

const creationStatusLabels: Record<CreationSession["status"], string> = {
  draft: "草稿",
  generating: "生成中",
  preview: "待保存",
  saved: "已保存",
  failed: "失败",
  canceled: "已取消",
};

const CreationSessionList: React.FC<{
  sessions: CreationSession[];
  isLoading: boolean;
  onDuplicateSession: (sessionId: number) => Promise<void>;
}> = ({ sessions, isLoading, onDuplicateSession }) => {
  const [duplicatingId, setDuplicatingId] = React.useState<number | null>(null);
  if (isLoading) return <LoadingSpinner label="正在加载创作记录" />;
  if (sessions.length === 0) return <EmptyFactState message="还没有创作记录。" />;

  const handleDuplicate = async (event: React.MouseEvent<HTMLButtonElement>, sessionId: number) => {
    event.preventDefault();
    event.stopPropagation();
    setDuplicatingId(sessionId);
    try {
      await onDuplicateSession(sessionId);
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {sessions.map((session) => {
        const canViewBook = Boolean(session.saved_book_id);
        const displayTitle = session.display_title || session.saved_book_title || session.title_snapshot || "我的专属绘本";
        const primaryHref = canViewBook ? bookDetailHref(session.saved_book_id as number) : creationSessionHref(session.id);
        return (
          <article
            key={session.id}
            className="group rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-3 transition hover:border-[rgba(212,114,92,0.24)] hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--text-dark)]">
                  {displayTitle}
                </p>
                <p className="mt-1 text-xs text-[var(--text-light)]">
                  {creationTypeLabels[session.creation_type]} · {session.target_page_count} 页
                  {session.duplicated_from_session_id ? " · 来自副本" : ""} · 更新于 {formatDateTime(session.updated_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--terracotta)] no-underline opacity-90 transition hover:text-[var(--terracotta)] group-hover:opacity-100"
                    href={primaryHref}
                  >
                    {canViewBook ? <Eye className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
                    {canViewBook ? "查看绘本" : "继续创作"}
                  </a>
                  <button
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--sage-deep)] transition hover:text-[var(--terracotta)] disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={duplicatingId === session.id}
                    onClick={(event) => void handleDuplicate(event, session.id)}
                  >
                    <BookCopy className="h-3.5 w-3.5" />
                    {duplicatingId === session.id ? "复制中" : "复制再创作"}
                  </button>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[rgba(245,166,35,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#B8751A]">
                {creationStatusLabels[session.status]}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
};

const EmptyFactState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-[var(--cream)] px-4 py-5 text-sm text-[var(--text-light)]">
    {message}
  </div>
);

const ResourceTile: React.FC<{ icon: React.ReactElement<{ className?: string }>; label: string; value: string | null | undefined }> = ({ icon, label, value }) => (
  <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-[var(--cream)] p-4 text-center">
    <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-[var(--terracotta)]">
      {React.cloneElement(icon, { className: "h-5 w-5" })}
    </span>
    <span className="block text-xs font-bold text-[var(--text-mid)]">{label}</span>
    <span className="mt-1 block truncate text-[11px] text-[var(--text-light)]">{value ?? "未设置"}</span>
  </div>
);

const TaxonomyTagList: React.FC<{ codes: string[]; items: Array<{ code: string; name: string }> }> = ({ codes, items }) => (
  <div className="mb-3 flex flex-wrap gap-2">
    {codes.map((code) => {
      const label = items.find((item) => item.code === code)?.name ?? code;
      return (
        <span key={code} className="rounded-full border border-[rgba(212,114,92,0.12)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-mid)]">
          {label}
        </span>
      );
    })}
  </div>
);

const ProfileFormModal: React.FC<{
  open: boolean;
  profile: ChildProfile | null;
  onClose: () => void;
  onSubmit: (payload: ChildProfilePayload) => void;
}> = ({ open, profile, onClose, onSubmit }) => {
  const [form, setForm] = React.useState<ChildProfilePayload>(emptyPayload);

  const { items: ageRangeItems } = useTaxonomyGroup("age_range");
  const { items: readingLevelItems } = useTaxonomyGroup("reading_level");
  const { items: interestTagItems } = useTaxonomyGroup("interest_tag");
  const { items: educationGoalItems } = useTaxonomyGroup("education_goal");

  React.useEffect(() => {
    setForm(
      profile
        ? {
            nickname: profile.nickname,
            age_range: profile.age_range,
            reading_level: profile.reading_level,
            interest_tags: profile.interest_tags,
            education_goals: profile.education_goals,
            default_character: profile.default_character,
            default_voice: profile.default_voice,
            default_art_style: profile.default_art_style,
          }
        : emptyPayload,
    );
  }, [profile, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.nickname.trim()) return;
    onSubmit({ ...form, nickname: form.nickname.trim() });
  };

  const toggleInterestTag = (value: ChildProfileInterestTag) => {
    setForm((current) => {
      const existing = current.interest_tags;
      return {
        ...current,
        interest_tags: existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value],
      };
    });
  };

  const toggleEducationGoal = (value: ChildProfileEducationGoal) => {
    setForm((current) => {
      const existing = current.education_goals;
      return {
        ...current,
        education_goals: existing.includes(value) ? existing.filter((item) => item !== value) : [...existing, value],
      };
    });
  };

  return (
    <Modal
      open={open}
      title={profile ? "编辑儿童档案" : "添加儿童档案"}
      description="维护昵称、年龄、阅读水平和默认素材偏好。"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit}>
        <label className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]" htmlFor="profile-name">
          昵称
        </label>
        <Input
          id="profile-name"
          className="mb-4"
          placeholder="请输入昵称"
          value={form.nickname}
          onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
        />

        <div className="mb-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="block text-[13px] font-bold text-[var(--text-mid)]">
            <span className="mb-2 block">年龄段</span>
            <select
              className="h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm text-[var(--text-dark)] outline-none focus:border-[var(--honey)] focus:ring-4 focus:ring-[rgba(245,166,35,0.1)]"
              value={form.age_range ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, age_range: (event.target.value || null) as ChildProfilePayload["age_range"] }))}
            >
              {ageRangeItems.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="block text-[13px] font-bold text-[var(--text-mid)]">
            <span className="mb-2 block">阅读等级</span>
            <select
              className="h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm text-[var(--text-dark)] outline-none focus:border-[var(--honey)] focus:ring-4 focus:ring-[rgba(245,166,35,0.1)]"
              value={form.reading_level ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, reading_level: (event.target.value || null) as ChildProfilePayload["reading_level"] }))}
            >
              {readingLevelItems.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="mb-4">
          <legend className="mb-2 text-[13px] font-bold text-[var(--text-mid)]">兴趣标签</legend>
          <div className="flex flex-wrap gap-2">
            {interestTagItems.map((item) => {
              const selected = form.interest_tags.includes(item.code as ChildProfileInterestTag);
              return (
                <button
                  key={item.code}
                  className={cn(
                    "rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-all",
                    selected
                      ? "border-[var(--honey)] bg-[rgba(245,166,35,0.1)] text-[#D4882A]"
                      : "border-[rgba(212,114,92,0.12)] bg-white text-[var(--text-mid)] hover:border-[var(--honey)]",
                  )}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleInterestTag(item.code as ChildProfileInterestTag)}
                >
                  {selected ? "✓ " : ""}
                  {item.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-4">
          <legend className="mb-2 text-[13px] font-bold text-[var(--text-mid)]">教育目标</legend>
          <div className="flex flex-wrap gap-2">
            {educationGoalItems.map((item) => {
              const selected = form.education_goals.includes(item.code as ChildProfileEducationGoal);
              return (
                <button
                  key={item.code}
                  className={cn(
                    "rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-all",
                    selected
                      ? "border-[var(--honey)] bg-[rgba(245,166,35,0.1)] text-[#D4882A]"
                      : "border-[rgba(212,114,92,0.12)] bg-white text-[var(--text-mid)] hover:border-[var(--honey)]",
                  )}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleEducationGoal(item.code as ChildProfileEducationGoal)}
                >
                  {selected ? "✓ " : ""}
                  {item.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-4 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          <div className="block text-[13px] font-bold text-[var(--text-mid)]">
            <span className="mb-2 block">默认形象</span>
            <select
              className="h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm text-[var(--text-dark)] outline-none focus:border-[var(--honey)] focus:ring-4 focus:ring-[rgba(245,166,35,0.1)]"
              value={form.default_character ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, default_character: (event.target.value || null) as ChildProfilePayload["default_character"] }))}
            >
              <option value="">暂无可选择的形象</option>
            </select>
          </div>
          <div className="block text-[13px] font-bold text-[var(--text-mid)]">
            <span className="mb-2 block">默认声音</span>
            <Input
              value={form.default_voice ?? ""}
              placeholder="声音 ID，可留空"
              onChange={(event) => setForm((current) => ({ ...current, default_voice: (event.target.value || null) as ChildProfilePayload["default_voice"] }))}
            />
          </div>
          <div className="block text-[13px] font-bold text-[var(--text-mid)]">
            <span className="mb-2 block">默认画风</span>
            <select
              className="h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm text-[var(--text-dark)] outline-none focus:border-[var(--honey)] focus:ring-4 focus:ring-[rgba(245,166,35,0.1)]"
              value={form.default_art_style ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, default_art_style: (event.target.value || null) as ChildProfilePayload["default_art_style"] }))}
            >
              <option value="">暂无可选择的画风</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={!form.nickname.trim()}>
            保存档案
          </Button>
        </div>
      </form>
    </Modal>
  );
};
