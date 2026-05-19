import React from "react";
import { Check, Play, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssetAccessBadge } from "./AssetAccessBadge";

interface AssetCardProps {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  icon?: React.ReactNode;
  accessLevel?: "free" | "vip";
  selected?: boolean;
  isDefault?: boolean;
  statusLabel?: string;
  onSelect?: () => void;
  onPreview?: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  title,
  subtitle,
  imageUrl,
  icon,
  accessLevel = "free",
  selected,
  isDefault,
  statusLabel,
  onSelect,
  onPreview,
  onSetDefault,
  onDelete,
}) => (
  <article
    className={cn(
      "app-card app-card-hover relative flex min-h-[220px] flex-col overflow-hidden p-4",
      selected && "outline outline-2 outline-[var(--terracotta)]",
    )}
  >
    <div className="absolute right-3 top-3 flex items-center gap-2">
      {isDefault ? <span className="rounded-full bg-[rgba(245,166,35,0.16)] px-2 py-1 text-xs font-bold text-[var(--honey)]">默认</span> : null}
      <AssetAccessBadge accessLevel={accessLevel} />
    </div>
    <button
      className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[rgba(126,200,227,0.12)]"
      onClick={onSelect}
      type="button"
      aria-label={`选择${title}`}
    >
      {imageUrl ? <img className="h-full w-full object-cover" alt={title} src={imageUrl} /> : <span className="text-4xl">{icon}</span>}
    </button>
    <div className="mt-3 min-w-0">
      <h3 className="truncate text-base font-bold">{title}</h3>
      {subtitle ? <p className="mt-1 min-h-[38px] overflow-hidden text-xs text-[var(--text-light)]">{subtitle}</p> : null}
      {statusLabel ? <p className="mt-2 text-xs font-semibold text-[var(--terracotta)]">{statusLabel}</p> : null}
    </div>
    <div className="mt-auto flex flex-wrap gap-2 pt-4">
      {onSelect ? (
        <Button size="sm" variant={selected ? "default" : "outline"} onClick={onSelect}>
          <Check className="h-4 w-4" />
          选择
        </Button>
      ) : null}
      {onPreview ? (
        <Button size="sm" variant="ghost" onClick={onPreview} aria-label={`试听或预览${title}`}>
          <Play className="h-4 w-4" />
        </Button>
      ) : null}
      {onSetDefault ? (
        <Button size="sm" variant="ghost" onClick={onSetDefault} aria-label={`设为默认：${title}`}>
          <Star className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button size="sm" variant="ghost" onClick={onDelete} aria-label={`删除${title}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  </article>
);
