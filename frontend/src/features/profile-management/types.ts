export type ChildProfileAgeRange = "age_3_4" | "age_5_6" | "age_7_8" | "age_9_10";
export type ChildProfileReadingLevel = "starter" | "growing" | "independent";
export type ChildProfileInterestTag =
  | "animals"
  | "fairy_tale"
  | "music"
  | "space"
  | "nature"
  | "friendship"
  | "science"
  | "adventure";
export type ChildProfileEducationGoal = "emotion" | "habit" | "language" | "courage" | "social" | "creativity";
export type ChildProfileDefaultCharacter = "star-child" | "forest-friend" | "little-captain";
export type ChildProfileDefaultVoice = "warm-mom" | "story-dad" | "clear-teacher";
export type ChildProfileDefaultArtStyle = "watercolor" | "crayon" | "bedtime";

export interface ChildProfile {
  id: number;
  user_id?: number;
  nickname: string;
  age_range: ChildProfileAgeRange | null;
  age_range_label?: string | null;
  reading_level: ChildProfileReadingLevel | null;
  reading_level_label?: string | null;
  interest_tags: ChildProfileInterestTag[];
  education_goals: ChildProfileEducationGoal[];
  default_character: ChildProfileDefaultCharacter | null;
  default_voice: ChildProfileDefaultVoice | null;
  default_art_style: ChildProfileDefaultArtStyle | null;
  is_default: boolean;
  status?: string;
}

export interface ChildProfilePayload {
  nickname: string;
  age_range: ChildProfileAgeRange | null;
  reading_level: ChildProfileReadingLevel | null;
  interest_tags: ChildProfileInterestTag[];
  education_goals: ChildProfileEducationGoal[];
  default_character: ChildProfileDefaultCharacter | null;
  default_voice: ChildProfileDefaultVoice | null;
  default_art_style: ChildProfileDefaultArtStyle | null;
}
