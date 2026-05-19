import React, { useState } from "react";
import { Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/shared/ui/toast";
import { shareApi } from "./api";
import type { ShareAccessScope, ShareLink } from "./types";

interface ShareDialogProps {
  bookId: number;
  getPrivacyConfirmationId?: (action: "share") => Promise<number | null>;
  onCreated?: (link: ShareLink) => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ bookId, getPrivacyConfirmationId, onCreated }) => {
  const [scope, setScope] = useState<ShareAccessScope>("public");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<ShareLink | null>(null);
  const [loading, setLoading] = useState(false);
  const createKeyRef = React.useRef<string | null>(null);
  const { showToast } = useToast();

  const url = created?.public_url ? new URL(created.public_url, window.location.origin).toString() : "";

  const handleCreate = async () => {
    if (scope === "password" && password.trim().length < 4) {
      showToast("密码分享至少需要 4 位访问密码", "error");
      return;
    }
    if (createKeyRef.current) return;
    createKeyRef.current = crypto.randomUUID?.() ?? `share-${bookId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLoading(true);
    try {
      const privacyConfirmationId = await getPrivacyConfirmationId?.("share");
      const link = await shareApi.create(bookId, {
        access_scope: scope,
        password: scope === "password" ? password.trim() : null,
        privacy_confirmation_id: privacyConfirmationId,
        idempotency_key: createKeyRef.current,
      });
      if (link.public_url) setCreated(link);
      onCreated?.(link);
      showToast("分享链接已创建", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "创建分享失败", "error");
    } finally {
      createKeyRef.current = null;
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    showToast("链接已复制", "success");
  };

  return (
    <div className="app-card p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-[var(--sky-deep)]" />
        <h2 className="font-display text-2xl">分享链接</h2>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {(["public", "password"] as ShareAccessScope[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-[var(--radius-sm)] border px-3 py-2 ${scope === item ? "border-[var(--terracotta)] bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)]" : "border-[rgba(212,114,92,0.12)] bg-white text-[var(--text-mid)]"}`}
            onClick={() => setScope(item)}
          >
            {item === "public" ? "公开" : item === "password" ? "密码" : "指定"}
          </button>
        ))}
      </div>
      {scope === "password" ? (
        <label className="mt-3 block text-sm font-semibold text-[var(--text-mid)]">
          访问密码
          <input
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm font-normal"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      ) : null}
      {url ? (
        <div className="mt-4 flex gap-2 max-sm:flex-col">
          <input className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.12)] px-3 py-2 text-sm" readOnly value={url} />
          <Button variant="outline" onClick={handleCopy}><Copy className="h-4 w-4" />复制</Button>
        </div>
      ) : null}
      <Button className="mt-4 w-full" disabled={loading} onClick={handleCreate}>{loading ? "创建中..." : "生成分享链接"}</Button>
    </div>
  );
};
