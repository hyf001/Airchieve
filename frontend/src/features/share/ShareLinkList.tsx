import React from "react";
import { RotateCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ShareLink } from "./types";

interface ShareLinkListProps {
  links: ShareLink[];
  onClose?: (link: ShareLink) => void;
  onRegenerate?: (link: ShareLink) => void;
}

export const ShareLinkList: React.FC<ShareLinkListProps> = ({ links, onClose, onRegenerate }) => (
  <div className="overflow-hidden rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.08)] bg-white">
    {links.length ? links.map((link) => (
      <div key={link.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[rgba(212,114,92,0.06)] px-4 py-3 last:border-b-0 max-sm:grid-cols-1">
        <div>
          <div className="font-semibold text-[var(--text-dark)]">{link.title_snapshot}</div>
          <div className="text-xs text-[var(--text-light)]">访问 {link.access_count} 次 · {link.status}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onRegenerate?.(link)}><RotateCw className="h-3.5 w-3.5" />重置</Button>
          <Button size="sm" variant="ghost" onClick={() => onClose?.(link)}><XCircle className="h-3.5 w-3.5" />关闭</Button>
        </div>
      </div>
    )) : <div className="px-4 py-6 text-sm text-[var(--text-light)]">暂无分享记录。</div>}
  </div>
);
