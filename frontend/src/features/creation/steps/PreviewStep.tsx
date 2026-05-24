import React from "react";
import { Check } from "lucide-react";

import { StepPanel } from "../components";

export const PreviewStep: React.FC<{ previewItems: Array<[string, string]> }> = ({ previewItems }) => (
  <StepPanel icon={<Check className="h-5 w-5" />} title="播放预览" desc="确认图片、文字、音频与对白后保存到个人绘本库。">
    <div className="rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#ffe0b2,#b3e5fc)] p-8 text-center text-6xl shadow-inner">📖</div>
    <div className="mt-4 grid grid-cols-3 gap-3 text-sm max-sm:grid-cols-1">
      {previewItems.map(([label, value]) => (
        <div key={label} className="rounded-[var(--radius-sm)] bg-[var(--warm-bg)] px-3 py-2">
          <div className="text-xs text-[var(--text-light)]">{label}</div>
          <div className="font-semibold text-[var(--text-mid)]">{value}</div>
        </div>
      ))}
    </div>
  </StepPanel>
);
