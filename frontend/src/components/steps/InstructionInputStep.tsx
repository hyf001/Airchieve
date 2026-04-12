/**
 * 指令输入步骤组件
 * 绘本创建流程的第一步：用户输入故事指令和参数
 */
import React, { useState, useCallback } from 'react';
import { Wand2, BookOpen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StoryParams, STORY_TYPE_LABELS, LANGUAGE_LABELS, AGE_GROUP_LABELS, CLI_TYPE_LABELS } from '@/types/creation';
import { CliType } from '@/services/storybookService';

type InputMode = 'ai' | 'manual';

interface InstructionInputStepProps {
  storyParams: StoryParams;
  onStoryParamsChange: (params: StoryParams) => void;
  cli_type: CliType;
  onCliTypeChange: (cli_type: CliType) => void;
  onSubmit: (prompt: string, mode: InputMode) => void;
}

const InstructionInputStep: React.FC<InstructionInputStepProps> = ({
  storyParams,
  onStoryParamsChange,
  cli_type,
  onCliTypeChange,
  onSubmit,
}) => {
  const [prompt, setPrompt] = useState('');
  const [storyText, setStoryText] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('ai');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentInput = inputMode === 'ai' ? prompt : storyText;

  const handleSubmit = useCallback(async () => {
    const text = inputMode === 'ai' ? prompt : storyText;
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(text, inputMode);
    } finally {
      setIsSubmitting(false);
    }
  }, [prompt, storyText, inputMode, isSubmitting, onSubmit]);

  const handleParamChange = useCallback(
    <K extends keyof StoryParams>(key: K, value: StoryParams[K]) => {
      onStoryParamsChange({ ...storyParams, [key]: value });
    },
    [storyParams, onStoryParamsChange]
  );

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">输入指令</h2>
          <p className="text-sm text-slate-400">描述您的故事创意</p>
        </div>
      </div>

      {/* 输入框区域（保留蓝色光晕） */}
      <div className="w-full relative">
        {/* 蓝色光晕层 */}
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-sky-300/50 via-blue-300/40 to-cyan-300/45 blur-2xl pointer-events-none" />
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-white/60 to-sky-100/30 blur-md pointer-events-none" />

        {/* 玻璃卡片 */}
        <div className="relative rounded-2xl overflow-hidden bg-white/72 backdrop-blur-2xl border border-white/70 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="px-5 pt-4 pb-3">
            {/* 模式切换 */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setInputMode('ai')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  inputMode === 'ai'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Wand2 size={12} />
                AI 生成故事
              </button>
              <button
                onClick={() => setInputMode('manual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  inputMode === 'manual'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <BookOpen size={12} />
                输入现有故事
              </button>
            </div>

            {/* AI 模式输入框 */}
            {inputMode === 'ai' ? (
              <>
                <Textarea
                  rows={4}
                  className="resize-none bg-transparent border-0 shadow-none focus-visible:ring-0 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-500 placeholder:font-medium p-0"
                  placeholder="描述您的故事创意... 比如：一只名叫 Nutty 的小松鼠在一棵老橡树中发现了一扇神秘的门..."
                  value={prompt}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setPrompt(e.target.value);
                    }
                  }}
                  disabled={isSubmitting}
                />
                <div className="text-right text-xs text-slate-800 mt-1">{prompt.length}/500</div>
              </>
            ) : (
              <>
                <Textarea
                  rows={10}
                  className="resize-y bg-transparent border border-slate-200 rounded-lg focus-visible:ring-1 focus-visible:ring-amber-400 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 placeholder:font-medium p-3"
                  placeholder="请输入您现有的故事内容..."
                  value={storyText}
                  onChange={(e) => {
                    if (e.target.value.length <= 10000) {
                      setStoryText(e.target.value);
                    }
                  }}
                  disabled={isSubmitting}
                />
                <div className="text-right text-xs text-slate-800 mt-1">{storyText.length}/10000</div>
              </>
            )}
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center gap-2 px-4 py-3 flex-nowrap border-t border-white/50 bg-white/20">
            {/* 故事参数选择器（仅 AI 模式显示） */}
            {inputMode === 'ai' && (
            <div className="flex items-center gap-2 shrink-0">
              {/* 字数 */}
              <Select
                value={String(storyParams.word_count)}
                onValueChange={(v) => handleParamChange('word_count', Number(v))}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">字数</span>
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-white/70">
                  <SelectItem value="300">300字</SelectItem>
                  <SelectItem value="500">500字</SelectItem>
                  <SelectItem value="800">800字</SelectItem>
                  <SelectItem value="1000">1000字</SelectItem>
                  <SelectItem value="1500">1500字</SelectItem>
                  <SelectItem value="2000">2000字</SelectItem>
                </SelectContent>
              </Select>

              {/* 故事类型 */}
              <Select
                value={storyParams.story_type}
                onValueChange={(v) => handleParamChange('story_type', v as StoryParams['story_type'])}
              >
                <SelectTrigger className="h-8 w-[110px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                  <SelectValue placeholder="类型" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-white/70">
                  {Object.entries(STORY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 语言 */}
              <Select
                value={storyParams.language}
                onValueChange={(v) => handleParamChange('language', v as StoryParams['language'])}
              >
                <SelectTrigger className="h-8 w-[80px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-white/70">
                  {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 年龄组 */}
              <Select
                value={storyParams.age_group}
                onValueChange={(v) => handleParamChange('age_group', v as StoryParams['age_group'])}
              >
                <SelectTrigger className="h-8 w-[90px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-white/70">
                  {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            {/* AI 模型（两种模式都显示） */}
            <Select
              value={cli_type}
              onValueChange={(v) => onCliTypeChange(v as CliType)}
            >
              <SelectTrigger className="h-8 w-[90px] text-xs bg-white/60 border-white/70 text-slate-700 shadow-sm focus:ring-[#00CDD4]/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">模型</span>
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white/95 border-white/70">
                {Object.entries(CLI_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 占位，将按钮推到右侧 */}
            <div className="flex-1" />

            {/* 创建按钮 */}
            <Button
              disabled={isSubmitting}
              onClick={handleSubmit}
              variant="gradient-rose"
              className="shrink-0 px-8 h-10 rounded-full shadow-lg hover:shadow-purple-400/60 hover:scale-105 active:scale-95 transition-all"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>{inputMode === 'ai' ? '正在创建故事...' : '正在生成分镜...'}</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} strokeWidth={2} />
                  <span>{inputMode === 'ai' ? '创建故事' : '下一步'}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructionInputStep;
