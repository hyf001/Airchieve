import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmText = '删除',
  cancelText = '取消',
  variant = 'destructive',
  onConfirm,
  onCancel,
}) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-slate-500">{description}</p>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>{cancelText}</Button>
        <Button variant={variant} onClick={onConfirm}>{confirmText}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ConfirmDialog;
export { ConfirmDialog };
