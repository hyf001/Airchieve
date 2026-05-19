import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

interface UploadConsentDialogProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const UploadConsentDialog: React.FC<UploadConsentDialogProps> = ({ checked, onCheckedChange }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.12)] bg-[rgba(139,198,168,0.08)] p-4">
      <label className="flex items-start gap-3 text-sm font-semibold text-[var(--text-dark)]">
        <input className="mt-1 h-4 w-4" type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
        <span className="flex-1">
          我确认拥有上传素材的使用授权，并理解个人素材默认仅账号内可见。
          {expanded ? (
            <span className="mt-1 block text-xs font-normal text-[var(--text-light)]">
              上传头像、参考图或声音样本前，请确认已获得本人或监护人的同意；分享或导出含个人素材的绘本时会再次提示隐私风险。
            </span>
          ) : null}
        </span>
        <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--sage-deep)]" />
      </label>
      <Button className="mt-2 px-0" variant="link" type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "收起提示" : "查看授权提示"}
      </Button>
    </div>
  );
};
