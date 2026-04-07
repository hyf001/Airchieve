/**
 * 生成封底对话框组件
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Storybook } from '@/services/storybookService';
import BackCoverMode from '@/pages/editor/BackCoverMode';

interface BackCoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storybook: Storybook | null;
  onBackCoverCreated?: () => void;
}

export const BackCoverDialog: React.FC<BackCoverDialogProps> = ({
  open,
  onOpenChange,
  storybook,
  onBackCoverCreated,
}) => {
  if (!storybook) return null;

  const pages = storybook.pages || [];
  const hasBackCover = pages.some(p => p.page_type === 'back_cover');

  const handleBackCoverCreated = async () => {
    onOpenChange(false);
    onBackCoverCreated?.();
  };

  // 如果已有封底，显示提示
  if (hasBackCover) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成封底</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-sm text-slate-600 mb-4">
              此绘本已经创建了封底，无法重复创建
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 显示嵌入式编辑器
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex flex-col h-[80vh]">
          {/* 简化的顶部栏 */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-800">生成封底</h2>
              <p className="text-xs text-slate-500">为《{storybook.title}》创建封底</p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          </div>

          {/* 嵌入 BackCoverMode 的内容 */}
          <div className="flex-1 overflow-hidden">
            <BackCoverMode
              storybook={storybook}
              onBack={() => onOpenChange(false)}
              onBackCoverCreated={handleBackCoverCreated}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BackCoverDialog;
