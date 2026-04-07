/**
 * 统一的步骤容器组件
 * 提供一致的布局、视觉效果和交互模式
 */
import React, { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StepContainerProps {
  /** 步骤图标 */
  icon: React.ReactNode;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;
  /** 内容区域 */
  children: React.ReactNode;
  /** 参数区域（可选） */
  params?: React.ReactNode;
  /** 上一步回调（可选） */
  onBack?: () => void;
  /** 下一步回调 */
  onNext: () => void | Promise<void>;
  /** 下一步按钮文字 */
  nextLabel: string;
  /** Loading提示文字 */
  loadingMessage?: string;
  /** 是否显示上一步按钮（默认true） */
  showBackButton?: boolean;
  /** 是否禁用下一步按钮 */
  disabled?: boolean;
}

const StepContainer: React.FC<StepContainerProps> = ({
  icon,
  title,
  description,
  children,
  params,
  onBack,
  onNext,
  nextLabel,
  loadingMessage = '处理中...',
  showBackButton = true,
  disabled = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = useCallback(async () => {
    if (isSubmitting || disabled) return;

    setIsSubmitting(true);
    try {
      await onNext();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, disabled, onNext]);

  return (
    <div className="w-full max-w-6xl mx-auto relative">
      {/* 紫色光晕层 */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-radial from-purple-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* 玻璃态卡片 */}
      <div className="relative glass-card rounded-3xl overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/50">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            {icon}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="px-6 py-6">
          {children}
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center gap-4 px-6 py-4 border-t border-slate-700/50 bg-slate-800/30">
          {/* 左侧：上一步按钮 */}
          {showBackButton && onBack && (
            <Button
              onClick={onBack}
              disabled={isSubmitting}
              variant="outline"
              className="shrink-0"
            >
              上一步
            </Button>
          )}

          {/* 中间：参数区域 */}
          {params ? (
            <div className="flex-1 flex items-center justify-center gap-3">
              {params}
            </div>
          ) : showBackButton && onBack ? (
            <div className="flex-1" />
          ) : null}

          {/* 右侧：下一步按钮 */}
          <Button
            onClick={handleNext}
            disabled={disabled || isSubmitting}
            variant="gradient"
            className="shrink-0 gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {loadingMessage}
              </>
            ) : (
              nextLabel
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StepContainer;
