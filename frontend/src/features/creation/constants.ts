import type { CreationStorySourceType } from "./types";

export type WizardPath = "story" | "template";
export type WizardStep = "source" | "character" | "style" | "storyboard" | "voice" | "lipSync" | "preview";

export const storySources: Array<{ value: CreationStorySourceType; title: string; desc: string }> = [
  { value: "system_story", title: "系统故事", desc: "使用平台精选故事作为蓝本" },
  { value: "user_story", title: "我的故事", desc: "从个人故事库选择已有故事" },
];

export const storySteps: Array<{ value: WizardStep; label: string }> = [
  { value: "source", label: "故事/模板" },
  { value: "style", label: "画风" },
  { value: "character", label: "形象" },
  { value: "storyboard", label: "分镜" },
  { value: "voice", label: "声音" },
  { value: "lipSync", label: "对口型" },
  { value: "preview", label: "预览" },
];

export const templateSteps: Array<{ value: WizardStep; label: string }> = [
  { value: "source", label: "故事/模板" },
  { value: "character", label: "形象" },
  { value: "voice", label: "声音" },
  { value: "preview", label: "预览" },
];

export const sourceLabel = (value: CreationStorySourceType) => storySources.find((source) => source.value === value)?.title ?? value;
