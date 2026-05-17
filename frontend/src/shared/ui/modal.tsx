import React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ open, title, description, children, footer, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[rgba(61,44,44,0.22)] p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-modal-title"
        className={cn(
          "w-full max-w-md rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white p-6 text-[var(--text-dark)] shadow-[var(--shadow-hover)]",
          "animate-in fade-in-0 zoom-in-95 duration-200",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="shared-modal-title" className="font-display text-2xl">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-[var(--text-light)]">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="关闭弹窗" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </section>
    </div>
  );
};
