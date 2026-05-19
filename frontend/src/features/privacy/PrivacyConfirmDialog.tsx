import React from "react";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PrivacyConfirmDialogProps {
  actionLabel: string;
  riskFlags: string[];
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const flagLabel: Record<string, string> = {
  personal_character: "个人形象",
  personal_voice: "个人声音",
};

export const PrivacyConfirmDialog: React.FC<PrivacyConfirmDialogProps> = ({ actionLabel, riskFlags, loading = false, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[rgba(61,44,44,0.32)] px-4">
    <div className="w-full max-w-[460px] rounded-[var(--radius-md)] bg-white p-5 shadow-[0_18px_60px_rgba(61,44,44,0.24)]">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-[var(--honey)]" />
        <h2 className="font-display text-2xl">隐私风险确认</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-mid)]">
        此绘本包含{riskFlags.map((flag) => flagLabel[flag] ?? flag).join("、")}。{actionLabel}前请确认已获得必要授权，并理解链接或文件可能被接收方继续传播。
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          取消
        </Button>
        <Button type="button" onClick={onConfirm} disabled={loading}>
          {loading ? "确认中..." : "我已了解，继续"}
        </Button>
      </div>
    </div>
  </div>
);
