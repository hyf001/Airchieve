import React from "react";
import { Check, Edit3, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type ChildProfile } from "@/features/profile-management";
import { useTaxonomyGroup } from "@/entities/taxonomy/useTaxonomyGroup";
import { cn } from "@/lib/utils";

interface ChildProfileCardProps {
  profile: ChildProfile;
  onEdit: (profile: ChildProfile) => void;
  onSelect: (profile: ChildProfile) => void;
  onOpenDetail: (profile: ChildProfile) => void;
}

const avatarStyles = [
  "bg-[linear-gradient(135deg,#FFE082,var(--honey),var(--peach))]",
  "bg-[linear-gradient(135deg,var(--sage),#A8E6CF,var(--sky))]",
  "bg-[linear-gradient(135deg,#E1BEE7,var(--lavender),#F48FB1)]",
  "bg-[linear-gradient(135deg,#BBDEFB,#64B5F6,#4BA3C7)]",
];

const ageBadgeClassNames: Record<string, string> = {
  age_3_4: "bg-[rgba(245,166,35,0.12)] text-[#D4882A]",
  age_5_6: "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]",
  age_7_8: "bg-[rgba(179,157,219,0.15)] text-[#7E57C2]",
  age_9_10: "bg-[rgba(126,200,227,0.16)] text-[var(--sky-deep)]",
};

const readingLevelPercents: Record<string, number> = {
  starter: 35,
  growing: 62,
  independent: 84,
};

const avatarIcons = ["🌟", "🌱", "🍓", "🚀"];

export const ChildProfileCard: React.FC<ChildProfileCardProps> = ({ profile, onEdit, onOpenDetail, onSelect }) => {
  const { labelMap: ageLabels } = useTaxonomyGroup("age_range");
  const { labelMap: readingLabels } = useTaxonomyGroup("reading_level");
  const { items: interestItems } = useTaxonomyGroup("interest_tag");

  const hash = Array.from(String(profile.id)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const readingLevelLabel = profile.reading_level ? readingLabels[profile.reading_level] ?? profile.reading_level_label : undefined;
  const readingPercent = profile.reading_level ? readingLevelPercents[profile.reading_level] ?? 50 : 50;
  const ageBadgeClassName = profile.age_range ? ageBadgeClassNames[profile.age_range] : undefined;
  const ageLabel = profile.age_range ? ageLabels[profile.age_range] ?? profile.age_range_label : undefined;
  const tagLabels = profile.interest_tags
    .map((tagCode) => interestItems.find((item) => item.code === tagCode)?.name ?? tagCode)
    .slice(0, 4);

  return (
    <article
      className={cn(
        "app-card app-card-hover relative overflow-hidden border-2 p-7",
        profile.is_default ? "border-[var(--honey)] shadow-[0_4px_24px_rgba(245,166,35,0.2)]" : "border-transparent",
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--honey),var(--peach))]" />
      {profile.is_default ? (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,var(--honey),var(--peach))] px-3 py-1 text-[11px] font-bold text-white">
          <Star className="h-3 w-3 fill-current" />
          当前
        </span>
      ) : null}

      <button
        className="mb-5 flex w-full items-center gap-5 text-left"
        type="button"
        onClick={() => onOpenDetail(profile)}
      >
        <span
          className={cn(
            "flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-[32px] shadow-[0_4px_16px_rgba(0,0,0,0.1)]",
            avatarStyles[hash % avatarStyles.length],
          )}
        >
          {avatarIcons[hash % avatarIcons.length]}
        </span>
        <span className="min-w-0">
          <span className="font-display block truncate text-[22px]">{profile.nickname}</span>
          <span
            className={cn(
              "mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold",
              ageBadgeClassName ?? "bg-[rgba(212,114,92,0.08)] text-[var(--text-mid)]",
            )}
          >
            {ageLabel ?? profile.age_range_label ?? "未设置年龄"}
          </span>
        </span>
      </button>

      <div className="mb-5 flex min-h-8 flex-wrap gap-2">
        {tagLabels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-[rgba(212,114,92,0.1)] bg-[var(--cream)] px-3.5 py-1 text-xs font-medium text-[var(--text-mid)]"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mb-5">
        <div className="mb-2 flex justify-between text-xs text-[var(--text-light)]">
          <span>阅读等级</span>
          <span>{readingLevelLabel ?? profile.reading_level_label ?? "未设置"}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--cream)]">
          <span
            className="block h-full rounded-full bg-[linear-gradient(90deg,var(--honey),var(--peach))]"
            style={{ width: `${readingPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          className={cn(profile.is_default && "border border-[rgba(245,166,35,0.3)] bg-[var(--cream)] text-[var(--honey)] shadow-none")}
          type="button"
          variant={profile.is_default ? "ghost" : "default"}
          onClick={() => onSelect(profile)}
        >
          {profile.is_default ? <Check className="h-4 w-4" /> : <Star className="h-4 w-4" />}
          {profile.is_default ? "当前档案" : "设为当前"}
        </Button>
        <Button type="button" variant="outline" onClick={() => onEdit(profile)}>
          <Edit3 className="h-4 w-4" />
          编辑
        </Button>
      </div>
    </article>
  );
};
