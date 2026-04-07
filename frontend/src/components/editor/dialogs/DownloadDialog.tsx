/**
 * 下载对话框组件
 */

import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (watermark: boolean) => void;
}

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>下载作品</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">是否在下载的图片中添加水印？</p>
        <DialogFooter className="flex gap-2 sm:flex-row flex-col">
          <Button variant="outline" onClick={() => onConfirm(false)}>
            去水印下载
          </Button>
          <Button variant="default" onClick={() => onConfirm(true)}>
            带水印下载
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadDialog;
