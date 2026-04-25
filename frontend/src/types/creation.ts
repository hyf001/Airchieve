/**
 * 绘本创建流程相关类型定义
 */

import { CliType, AspectRatio, ImageSize } from '../services/storybookService';
import { ImageStyleListItem } from '../services/imageStyleService';

/**
 * AI 模型标签映射
 */
export const CLI_TYPE_LABELS: Record<CliType, string> = {
  doubao: '豆包',
  gemini: 'Gemini'
};

/**
 * 创建流程步骤
 */
export type CreationStep = 'input' | 'story' | 'storyboard' | 'creating';

/**
 * 故事生成参数（步骤 1）
 */
export interface StoryParams {
  word_count: number;
  story_type: 'fairy_tale' | 'adventure' | 'education' | 'scifi' | 'fantasy' | 'animal' | 'daily_life' | 'bedtime_story';
  language: 'zh' | 'en' | 'ja' | 'ko';
  age_group: '0_3' | '3_6' | '6_8' | '8_12' | '12_plus';
}

/**
 * 绘本生成参数（步骤 4）
 */
export interface CreationParams {
  page_count?: number; // 页数在预览故事步骤设置，此处可选
  aspect_ratio: AspectRatio;
  image_size: ImageSize;
  cli_type: CliType;
}

/**
 * 分镜项
 */
export interface StoryboardItem {
  text: string;
  page_type?: 'cover' | 'content';
  storyboard: {
    scene: string;
    characters: string;
    shot: string;
    color: string;
    lighting: string;
  };
}

/**
 * 创建流程状态
 */
export interface CreationState {
  step: CreationStep;
  instruction: string;
  storyParams: StoryParams;           // 步骤 1 的参数
  storyTitle: string;
  storyContent: string;
  storyboards: StoryboardItem[];
  selectedImageStyle: ImageStyleListItem | null;
  uploadedImages: string[];
  creationParams: CreationParams;     // 步骤 4 的参数
}

/**
 * 故事类型标签映射
 */
export const STORY_TYPE_LABELS: Record<StoryParams['story_type'], string> = {
  fairy_tale: '童话',
  adventure: '冒险',
  education: '教育',
  scifi: '科幻',
  fantasy: '奇幻',
  animal: '动物',
  daily_life: '日常',
  bedtime_story: '睡前故事',
};

/**
 * 语言标签映射
 */
export const LANGUAGE_LABELS: Record<StoryParams['language'], string> = {
  zh: '中文',
  en: '英文',
  ja: '日文',
  ko: '韩文',
};

/**
 * 年龄组标签映射
 */
export const AGE_GROUP_LABELS: Record<StoryParams['age_group'], string> = {
  '0_3': '0-3岁',
  '3_6': '3-6岁',
  '6_8': '6-8岁',
  '8_12': '8-12岁',
  '12_plus': '12岁+',
};
