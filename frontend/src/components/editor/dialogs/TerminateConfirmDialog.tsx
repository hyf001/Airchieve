/**
 * 中止生成确认对话框组件
 */

import React from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface TerminateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const TerminateConfirmDialog: React.FC<TerminateConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
}) => {
  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <ConfirmDialog
      open={open}
      title="确认停止"
      description="确定要停止生成吗？已生成的页面将保留。"
      confirmText="停止"
      cancelText="取消"
      onConfirm={handleConfirm}
      onCancel={() => onOpenChange(false)}
    />
  );
};

export default TerminateConfirmDialog;
