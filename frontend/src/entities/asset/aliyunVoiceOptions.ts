export interface AliyunVoiceOption {
  code: string;
  label: string;
  description: string;
  supportedEmotions: string[];
}

export interface VoiceEmotionOption {
  code: string;
  label: string;
}

export const voiceEmotionOptions: VoiceEmotionOption[] = [
  { code: "neutral", label: "中性" },
  { code: "serious", label: "严肃" },
  { code: "sad", label: "悲伤" },
  { code: "disgust", label: "厌恶" },
  { code: "jealousy", label: "嫉妒" },
  { code: "embarrassed", label: "尴尬" },
  { code: "happy", label: "开心" },
  { code: "fear", label: "害怕" },
  { code: "surprise", label: "惊讶" },
  { code: "frustrated", label: "沮丧" },
  { code: "affectionate", label: "亲切" },
  { code: "gentle", label: "温柔" },
  { code: "angry", label: "生气" },
  { code: "newscast", label: "新闻播报" },
  { code: "customer-service", label: "客服" },
  { code: "story", label: "讲故事" },
  { code: "living", label: "生活化" },
  { code: "hate", label: "讨厌" },
  { code: "arousal", label: "高唤醒" },
];

export const aliyunVoiceOptions: AliyunVoiceOption[] = [
  {
    code: "zhimiao_emo",
    label: "知妙 - 多情感女声",
    description: "支持多情感，适合儿童绘本旁白和情绪化对白。",
    supportedEmotions: [
      "serious",
      "sad",
      "disgust",
      "jealousy",
      "embarrassed",
      "happy",
      "fear",
      "surprise",
      "neutral",
      "frustrated",
      "affectionate",
      "gentle",
      "angry",
      "newscast",
      "customer-service",
      "story",
      "living",
    ],
  },
  {
    code: "zhimi_emo",
    label: "知米 - 多情感女声",
    description: "支持多情感，适合通用故事和中英文混合内容。",
    supportedEmotions: ["angry", "fear", "happy", "hate", "neutral", "sad", "surprise"],
  },
  {
    code: "zhiyan_emo",
    label: "知燕 - 多情感女声",
    description: "支持多情感，语气自然细腻。",
    supportedEmotions: ["neutral", "happy", "angry", "sad", "fear", "hate", "surprise", "arousal"],
  },
  { code: "xiaoyun", label: "小云 - 标准女声", description: "通用中文女声。", supportedEmotions: [] },
  { code: "xiaogang", label: "小刚 - 标准男声", description: "通用中文男声。", supportedEmotions: [] },
  { code: "aixia", label: "艾夏 - 普通话女声", description: "亲和自然，适合客服和旁白场景。", supportedEmotions: [] },
  { code: "aiqi", label: "艾琪 - 温柔女声", description: "温柔细腻，适合睡前故事。", supportedEmotions: [] },
  { code: "aijia", label: "艾佳 - 标准女声", description: "自然清晰，适合通用绘本朗读。", supportedEmotions: [] },
  { code: "aicheng", label: "艾诚 - 标准男声", description: "沉稳清晰，适合知识和冒险故事。", supportedEmotions: [] },
  { code: "aida", label: "艾达 - 标准男声", description: "自然男声，适合长篇旁白。", supportedEmotions: [] },
  { code: "siyue", label: "思悦 - 温柔女声", description: "柔和舒缓，适合亲子共读。", supportedEmotions: [] },
  { code: "aiya", label: "艾雅 - 严厉女声", description: "语气更有力度，适合特定角色。", supportedEmotions: [] },
];

export const aliyunVoiceLabelMap = Object.fromEntries(aliyunVoiceOptions.map((option) => [option.code, option.label]));
export const voiceEmotionLabelMap = Object.fromEntries(voiceEmotionOptions.map((option) => [option.code, option.label]));
