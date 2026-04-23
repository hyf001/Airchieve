/**
 * 重新生成页面对话框组件
 * 从 regenerate 工具迁移而来
 */
import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, ImageIcon, FileText, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  regeneratePage,
  InsufficientPointsError,
  PageType,
} from '@/services/storybookService';

interface RegeneratePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybookId: string | number;
  pageId: number | undefined;
  pageType: PageType | undefined;
  pages: Array<{ id: number; text?: string; image_url?: string; page_type?: string }>;
  onPageRegenerated: (storybookId: number) => void;
}

type QuickAction = 'image' | 'text' | 'full';

export const RegeneratePageDialog: React.FC<RegeneratePageDialogProps> = ({
  open,
  onOpenChange,
  storybookId,
  pageId,
  pageType,
  pages,
  onPageRegenerated,
}) => {
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 高级设置
  const [regenerateText, setRegenerateText] = useState(false);
  const [regenerateStoryboard, setRegenerateStoryboard] = useState(false);
  const [regenerateImage, setRegenerateImage] = useState(true);
  const [selectedReferencePageIds, setSelectedReferencePageIds] = useState<number[]>([]);

  const isBackCover = pageType === 'back_cover';
  const isCover = pageType === 'cover';
  const referencePages = pages.filter(page => page.page_type === 'content' && page.image_url);

  // 重置状态
  const resetState = useCallback(() => {
    setInstruction('');
    setShowAdvanced(false);
    setRegenerateText(false);
    setRegenerateStoryboard(false);
    setRegenerateImage(true);
    setSelectedReferencePageIds([]);
  }, []);

  const handleQuickAction = useCallback(async (action: QuickAction) => {
    if (!pageId) return;

    let req;
    switch (action) {
      case 'image':
        req = {
          regenerate_text: false, text_instruction: '',
          regenerate_storyboard: false, storyboard_instruction: '',
          regenerate_image: true, image_instruction: instruction,
          reference_page_ids: selectedReferencePageIds,
        };
        break;
      case 'text':
        req = {
          regenerate_text: true, text_instruction: instruction,
          regenerate_storyboard: true, storyboard_instruction: instruction,
          regenerate_image: false, image_instruction: '',
          reference_page_ids: selectedReferencePageIds,
        };
        break;
      case 'full':
        req = {
          regenerate_text: true, text_instruction: instruction,
          regenerate_storyboard: true, storyboard_instruction: instruction,
          regenerate_image: true, image_instruction: instruction,
          reference_page_ids: [] as number[],
        };
        break;
    }

    await doRegenerate(req);
  }, [pageId, instruction, selectedReferencePageIds]);

  const handleAdvancedRegenerate = useCallback(async () => {
    if (!pageId) return;
    if (!regenerateText && !regenerateStoryboard && !regenerateImage) {
      toast({ variant: 'destructive', title: '请至少选择一项重新生成内容' });
      return;
    }

    await doRegenerate({
      regenerate_text: regenerateText,
      text_instruction: instruction,
      regenerate_storyboard: regenerateStoryboard,
      storyboard_instruction: instruction,
      regenerate_image: regenerateImage,
      image_instruction: instruction,
      reference_page_ids: selectedReferencePageIds,
    });
  }, [pageId, regenerateText, regenerateStoryboard, regenerateImage, instruction, selectedReferencePageIds]);

  const toggleReferencePage = (id: number) => {
    setSelectedReferencePageIds(prev =>
      prev.includes(id) ? prev.filter(pageId => pageId !== id) : [...prev, id].slice(-3)
    );
  };

  const doRegenerate = async (req: {
    regenerate_text: boolean; text_instruction: string;
    regenerate_storyboard: boolean; storyboard_instruction: string;
    regenerate_image: boolean; image_instruction: string;
    reference_page_ids: number[];
  }) => {
    if (!pageId) return;

    setIsRegenerating(true);
    try {
      const result = await regeneratePage(pageId, req);
      toast({ title: '页面重新生成中', description: '请稍候，完成后将自动刷新' });
      onPageRegenerated(result.storybook_id);
      resetState();
      onOpenChange(false);
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({
          variant: 'destructive',
          title: '重新生成失败',
          description: err instanceof Error ? err.message : undefined,
        });
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const quickActions = isCover
    ? [
        { action: 'image' as QuickAction, label: '调整封面图', icon: ImageIcon },
        { action: 'full' as QuickAction, label: '重做封面', icon: RefreshCw },
      ]
    : [
        { action: 'image' as QuickAction, label: '只改图片', icon: ImageIcon },
        { action: 'text' as QuickAction, label: '优化文字', icon: FileText },
        { action: 'full' as QuickAction, label: '重做这一页', icon: RefreshCw },
      ];

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) resetState();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>AI 调整当前页</DialogTitle>
        </DialogHeader>

        {isBackCover ? (
          <div className="py-4 text-center">
            <p className="text-sm text-slate-500">
              封底使用固定底图，请使用文字、图片、绘画等图层工具编辑封底内容。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 输入框 */}
            <div>
              <Label className="text-sm font-medium text-slate-700">
                描述你想怎么调整{isCover ? '封面' : '这一页'}
              </Label>
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                placeholder={`描述你想要的调整，例如：${isCover ? '让封面更温馨一些...' : '把画面改成夜晚的场景...'}`}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mt-2 resize-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
                disabled={isRegenerating}
              />
            </div>

            {/* 快捷操作 */}
            <div>
              <Label className="text-sm font-medium text-slate-700 block mb-2">快捷操作</Label>
              <div className="space-y-2">
                {quickActions.map(({ action, label, icon: Icon }) => (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action)}
                    disabled={isRegenerating}
                    className="w-full justify-start text-sm text-slate-600 border-slate-200 hover:bg-[#00CDD4]/5 hover:border-[#00CDD4]/30 hover:text-[#00CDD4]"
                  >
                    <Icon size={16} className="mr-2" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* 高级设置 */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showAdvanced ? <span>▼</span> : <span>▶</span>}
                高级设置
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="regen-text"
                      checked={regenerateText}
                      onCheckedChange={(checked) => setRegenerateText(checked === true)}
                    />
                    <Label htmlFor="regen-text" className="text-sm text-slate-600 cursor-pointer">
                      重新生成页面文本
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="regen-storyboard"
                      checked={regenerateStoryboard}
                      onCheckedChange={(checked) => setRegenerateStoryboard(checked === true)}
                    />
                    <Label htmlFor="regen-storyboard" className="text-sm text-slate-600 cursor-pointer">
                      重新生成画面分镜
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="regen-image"
                      checked={regenerateImage}
                      onCheckedChange={(checked) => setRegenerateImage(checked === true)}
                    />
                    <Label htmlFor="regen-image" className="text-sm text-slate-600 cursor-pointer">
                      重新生成页面图片
                    </Label>
                  </div>

                  {/* 参考页选择 */}
                  {(isCover || referencePages.length > 0) && (
                    <div className="pt-3 border-t border-slate-200">
                      <Label className="text-sm font-medium text-slate-700 block mb-2">
                        参考页（留空自动选择）
                      </Label>
                      <p className="text-xs text-slate-400 mb-2">
                        {isCover ? '默认自动选择正文页首/中/尾作为参考' : '可选择正文页作为画风或角色参考'}，最多手动选择 3 页
                      </p>
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {referencePages.map((page, index) => (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => toggleReferencePage(page.id)}
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              selectedReferencePageIds.includes(page.id)
                                ? 'border-[#00CDD4] bg-[#00CDD4]/10 text-slate-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            正文第 {index + 1} 页
                          </button>
                        ))}
                        {referencePages.length === 0 && (
                          <p className="text-sm text-slate-400">暂无已生成正文页可选</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {!isBackCover && showAdvanced && (
          <DialogFooter>
            <Button
              onClick={handleAdvancedRegenerate}
              disabled={isRegenerating || (!regenerateText && !regenerateStoryboard && !regenerateImage)}
              className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
            >
              {isRegenerating ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles size={16} className="mr-2" />
                  开始重新生成
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RegeneratePageDialog;
