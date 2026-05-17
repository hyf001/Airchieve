import React from "react";
import { BookOpen, Heart, Palette, Plus, Trash2, UserRound, Volume2, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountSummary } from "@/entities/account";
import { ChildProfileCard } from "@/entities/child-profile";
import { RequireAuth } from "@/features/auth";
import {
  ageRanges,
  defaultArtStyles,
  defaultCharacters,
  defaultVoices,
  educationGoals,
  getOptionLabel,
  interestTags,
  readingLevels,
  useProfiles,
  type ChildProfile,
  type ChildProfileEducationGoal,
  type ChildProfileInterestTag,
  type ChildProfilePayload,
} from "@/features/profile-management";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { LoadingSpinner } from "@/shared/ui/loading";
import { Modal } from "@/shared/ui/modal";

const emptyPayload: ChildProfilePayload = {
  nickname: "",
  age_range: "age_3_4",
  reading_level: "starter",
  interest_tags: ["animals"],
  education_goals: ["language"],
  default_character: "star-child",
  default_voice: "warm-mom",
  default_art_style: "watercolor",
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
  const activeDetail = detailProfile ?? currentProfile;

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
      <header className="mx-auto flex max-w-[1320px] items-end justify-between gap-6 px-8 pb-8 pt-12 max-md:flex-col max-md:items-start max-sm:px-4">
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

      <section className="mx-auto grid max-w-[1320px] grid-cols-[minmax(0,1fr)_320px] gap-7 px-8 pb-10 max-lg:grid-cols-1 max-sm:px-4">
        <div>
          {error ? (
            <div className="mb-5 rounded-[var(--radius-md)] border border-[rgba(245,166,35,0.22)] bg-[rgba(245,166,35,0.08)] px-4 py-3 text-sm text-[var(--text-mid)]">
              {error}，当前可继续预览和编辑本地演示档案。
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
        </div>

        <aside className="space-y-5">
          <AccountSummary />
          <section className="app-card p-6">
            <h2 className="font-display mb-3 text-xl">当前儿童档案</h2>
            {currentProfile ? (
              <div className="space-y-3 text-sm text-[var(--text-mid)]">
                <strong className="block text-lg text-[var(--text-dark)]">{currentProfile.nickname}</strong>
                <p>年龄：{getOptionLabel(ageRanges, currentProfile.age_range, currentProfile.age_range_label ?? "未设置")}</p>
                <p>阅读：{getOptionLabel(readingLevels, currentProfile.reading_level, currentProfile.reading_level_label ?? "未设置")}</p>
                <p>兴趣：{currentProfile.interest_tags.map((tagId) => getOptionLabel(interestTags, tagId)).join("、")}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-light)]">暂无当前档案</p>
            )}
          </section>
        </aside>
      </section>

      {activeDetail ? (
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
        onSubmit={(payload) => void handleSaveProfile(payload)}
      />
    </main>
  );
};

const ProfileDetailPanel: React.FC<{
  profile: ChildProfile;
  onClose: () => void;
  onDelete: (profile: ChildProfile) => void;
  onEdit: (profile: ChildProfile) => void;
}> = ({ profile, onClose, onDelete, onEdit }) => (
  <section className="mx-auto max-w-[1320px] px-8 pb-16 max-sm:px-4">
    <div className="app-card overflow-hidden rounded-[var(--radius-xl)]">
      <header className="flex items-center justify-between gap-4 border-b border-[rgba(212,114,92,0.08)] bg-[linear-gradient(135deg,#FFF8F0,#FFF0E5)] px-9 py-8 max-md:px-5">
        <div className="flex min-w-0 items-center gap-5">
          <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#FFE082,var(--honey),var(--peach))] text-4xl shadow-[0_6px_24px_rgba(245,166,35,0.3)]">
            🌟
          </span>
          <div className="min-w-0">
            <h2 className="font-display truncate text-[28px]">{profile.nickname}</h2>
            <p className="mt-1 text-sm text-[var(--text-light)]">
              {getOptionLabel(ageRanges, profile.age_range, profile.age_range_label ?? "未设置年龄")}
            </p>
          </div>
        </div>
        <Button aria-label="关闭详情" size="icon" variant="ghost" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="grid grid-cols-2 max-lg:grid-cols-1">
        <div className="border-r border-[rgba(212,114,92,0.08)] p-9 max-lg:border-b max-lg:border-r-0 max-md:p-5">
          <DetailSection icon={<Wand2 className="h-5 w-5" />} title="偏好配置">
            <TagList ids={profile.interest_tags} options={interestTags} />
            <TagList ids={profile.education_goals} options={educationGoals} />
            <div className="mt-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
              <ResourceTile icon={<UserRound />} label="默认形象" value={getOptionLabel(defaultCharacters, profile.default_character)} />
              <ResourceTile icon={<Volume2 />} label="默认声音" value={getOptionLabel(defaultVoices, profile.default_voice)} />
              <ResourceTile icon={<Palette />} label="默认画风" value={getOptionLabel(defaultArtStyles, profile.default_art_style)} />
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
          <DetailSection icon={<BookOpen className="h-5 w-5" />} title="阅读历史">
            <EmptyFactState message="当前没有可展示的真实阅读历史数据。" />
          </DetailSection>

          <DetailSection icon={<Heart className="h-5 w-5" />} title="收藏绘本">
            <EmptyFactState message="当前没有可展示的真实收藏绘本数据。" />
          </DetailSection>
        </div>
      </div>
    </div>
  </section>
);

const DetailSection: React.FC<React.PropsWithChildren<{ icon: React.ReactNode; title: string }>> = ({ children, icon, title }) => (
  <section className="mb-7 last:mb-0">
    <h3 className="font-display mb-4 flex items-center gap-2 text-lg">
      <span className="text-[var(--terracotta)]">{icon}</span>
      {title}
    </h3>
    {children}
  </section>
);

const EmptyFactState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-[var(--cream)] px-4 py-5 text-sm text-[var(--text-light)]">
    {message}
  </div>
);

const ResourceTile: React.FC<{ icon: React.ReactElement<{ className?: string }>; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-[var(--cream)] p-4 text-center">
    <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-[var(--terracotta)]">
      {React.cloneElement(icon, { className: "h-5 w-5" })}
    </span>
    <span className="block text-xs font-bold text-[var(--text-mid)]">{label}</span>
    <span className="mt-1 block truncate text-[11px] text-[var(--text-light)]">{value}</span>
  </div>
);

const TagList: React.FC<{ ids: string[]; options: Array<{ id: string; label: string }> }> = ({ ids, options }) => (
  <div className="mb-3 flex flex-wrap gap-2">
    {ids.map((id) => (
      <span key={id} className="rounded-full border border-[rgba(212,114,92,0.12)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-mid)]">
        {getOptionLabel(options, id)}
      </span>
    ))}
  </div>
);

const ProfileFormModal: React.FC<{
  open: boolean;
  profile: ChildProfile | null;
  onClose: () => void;
  onSubmit: (payload: ChildProfilePayload) => void;
}> = ({ open, profile, onClose, onSubmit }) => {
  const [form, setForm] = React.useState<ChildProfilePayload>(emptyPayload);

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
          placeholder="例如：小星星"
          value={form.nickname}
          onChange={(event) => setForm((current) => ({ ...current, nickname: event.target.value }))}
        />

        <div className="mb-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <SelectField
            label="年龄段"
            value={form.age_range ?? ""}
            options={ageRanges}
            onChange={(value) => setForm((current) => ({ ...current, age_range: value }))}
          />
          <SelectField
            label="阅读等级"
            value={form.reading_level ?? ""}
            options={readingLevels}
            onChange={(value) => setForm((current) => ({ ...current, reading_level: value }))}
          />
        </div>

        <TagPicker
          label="兴趣标签"
          selectedIds={form.interest_tags}
          options={interestTags}
          onToggle={toggleInterestTag}
        />
        <TagPicker
          label="教育目标"
          selectedIds={form.education_goals}
          options={educationGoals}
          onToggle={toggleEducationGoal}
        />

        <div className="mt-4 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          <SelectField
            label="默认形象"
            value={form.default_character ?? ""}
            options={defaultCharacters}
            onChange={(value) => setForm((current) => ({ ...current, default_character: value }))}
          />
          <SelectField
            label="默认声音"
            value={form.default_voice ?? ""}
            options={defaultVoices}
            onChange={(value) => setForm((current) => ({ ...current, default_voice: value }))}
          />
          <SelectField
            label="默认画风"
            value={form.default_art_style ?? ""}
            options={defaultArtStyles}
            onChange={(value) => setForm((current) => ({ ...current, default_art_style: value }))}
          />
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

interface SelectFieldProps<TId extends string> {
  label: string;
  value: TId | "";
  options: Array<{ id: TId; label: string }>;
  onChange: (value: TId) => void;
}

const SelectField = <TId extends string>({ label, onChange, options, value }: SelectFieldProps<TId>) => (
  <label className="block text-[13px] font-bold text-[var(--text-mid)]">
    <span className="mb-2 block">{label}</span>
    <select
      className="h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm text-[var(--text-dark)] outline-none focus:border-[var(--honey)] focus:ring-4 focus:ring-[rgba(245,166,35,0.1)]"
      value={value}
      onChange={(event) => onChange(event.target.value as TId)}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

interface TagPickerProps<TId extends string> {
  label: string;
  selectedIds: TId[];
  options: Array<{ id: TId; label: string }>;
  onToggle: (value: TId) => void;
}

const TagPicker = <TId extends string>({ label, onToggle, options, selectedIds }: TagPickerProps<TId>) => (
  <fieldset className="mb-4">
    <legend className="mb-2 text-[13px] font-bold text-[var(--text-mid)]">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <button
            key={option.id}
            className={cn(
              "rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-all",
              selected
                ? "border-[var(--honey)] bg-[rgba(245,166,35,0.1)] text-[#D4882A]"
                : "border-[rgba(212,114,92,0.12)] bg-white text-[var(--text-mid)] hover:border-[var(--honey)]",
            )}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(option.id)}
          >
            {selected ? "✓ " : ""}
            {option.label}
          </button>
        );
      })}
    </div>
  </fieldset>
);
