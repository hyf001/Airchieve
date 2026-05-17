import {
  type ChildProfileAgeRange,
  type ChildProfileDefaultArtStyle,
  type ChildProfileDefaultCharacter,
  type ChildProfileDefaultVoice,
  type ChildProfileEducationGoal,
  type ChildProfileInterestTag,
  type ChildProfileReadingLevel,
} from "./types";

interface ProfileOption<TId extends string = string> {
  id: TId;
  label: string;
}

interface AgeRangeOption extends ProfileOption<ChildProfileAgeRange> {
  badgeClassName: string;
}

interface ReadingLevelOption extends ProfileOption<ChildProfileReadingLevel> {
  percent: number;
}

export const ageRanges: AgeRangeOption[] = [
  { id: "age_3_4", label: "3-4岁", badgeClassName: "bg-[rgba(245,166,35,0.12)] text-[#D4882A]" },
  { id: "age_5_6", label: "5-6岁", badgeClassName: "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]" },
  { id: "age_7_8", label: "7-8岁", badgeClassName: "bg-[rgba(179,157,219,0.15)] text-[#7E57C2]" },
  { id: "age_9_10", label: "9-10岁", badgeClassName: "bg-[rgba(126,200,227,0.16)] text-[var(--sky-deep)]" },
];

export const readingLevels: ReadingLevelOption[] = [
  { id: "starter", label: "启蒙期", percent: 35 },
  { id: "growing", label: "成长期", percent: 62 },
  { id: "independent", label: "独立阅读", percent: 84 },
];

export const interestTags: ProfileOption<ChildProfileInterestTag>[] = [
  { id: "animals", label: "动物" },
  { id: "fairy_tale", label: "童话" },
  { id: "music", label: "儿歌" },
  { id: "space", label: "太空" },
  { id: "nature", label: "自然" },
  { id: "friendship", label: "朋友" },
  { id: "science", label: "科学" },
  { id: "adventure", label: "冒险" },
];

export const educationGoals: ProfileOption<ChildProfileEducationGoal>[] = [
  { id: "emotion", label: "情绪表达" },
  { id: "habit", label: "习惯养成" },
  { id: "language", label: "语言启蒙" },
  { id: "courage", label: "勇气建立" },
  { id: "social", label: "社交能力" },
  { id: "creativity", label: "想象力" },
];

export const defaultCharacters: ProfileOption<ChildProfileDefaultCharacter>[] = [
  { id: "star-child", label: "星星主角" },
  { id: "forest-friend", label: "森林伙伴" },
  { id: "little-captain", label: "小船长" },
];

export const defaultVoices: ProfileOption<ChildProfileDefaultVoice>[] = [
  { id: "warm-mom", label: "温柔妈妈" },
  { id: "story-dad", label: "故事爸爸" },
  { id: "clear-teacher", label: "清亮老师" },
];

export const defaultArtStyles: ProfileOption<ChildProfileDefaultArtStyle>[] = [
  { id: "watercolor", label: "柔和水彩" },
  { id: "crayon", label: "蜡笔童趣" },
  { id: "bedtime", label: "睡前暖光" },
];

export const getOptionLabel = (
  options: Array<ProfileOption>,
  id: string | null | undefined,
  fallback = "未设置",
) => options.find((option) => option.id === id)?.label ?? fallback;
