import React, { useMemo } from "react";
import { AlertCircle, CheckCircle2, Clapperboard, Image, Loader2, Mic2, Play, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepPanel } from "../components";
import type { CreationSession, PageDraft, PlaybackSegmentMark } from "../types";

type LipSyncStepProps = {
  isGenerating: boolean;
  generatingPageIds: number[] | null;
  session: CreationSession | null;
  onGeneratePage: (pageId: number) => void;
};

type LipSyncItem = {
  id: string;
  pageId: number;
  title: string;
  text: string;
  hasImage: boolean;
  hasAudio: boolean;
  hasLipSync: boolean;
  lipSyncUrl?: string | null;
};

export const LipSyncStep: React.FC<LipSyncStepProps> = ({ isGenerating, generatingPageIds, session, onGeneratePage }) => {
  const pages = session?.page_drafts ?? [];
  const dialoguePages = pages.filter((page) => page.playback_segments.some(isDialogueSegment));
  const imageCount = dialoguePages.filter((page) => page.image_url).length;
  const lipSyncItems = useMemo(() => pages.flatMap(toLipSyncItems), [pages]);
  const audioCount = lipSyncItems.filter((item) => item.hasAudio).length;
  const lipSyncCount = lipSyncItems.filter((item) => item.hasLipSync).length;
  const readyCount = lipSyncItems.filter((item) => item.hasImage && item.hasAudio && !item.hasLipSync).length;
  const canGenerate = readyCount > 0;

  return (
    <StepPanel icon={<Clapperboard className="h-5 w-5" />} title="对口型" desc="可选生成角色口型同步视频；跳过后仍可保存有插图和音频的绘本。">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Image className="h-4 w-4" />} label="对白页插图" value={`${imageCount}/${dialoguePages.length || 0}`} />
        <MetricCard icon={<Mic2 className="h-4 w-4" />} label="对白音频" value={`${audioCount}/${lipSyncItems.length || 0}`} />
        <MetricCard icon={<Video className="h-4 w-4" />} label="已同步口型" value={`${lipSyncCount}/${lipSyncItems.length || 0}`} />
      </div>

      <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--warm-bg)] p-4 text-sm leading-6 text-[var(--text-mid)]">
        {canGenerate
          ? "只为有对白的页面生成对口型。点击某条对白会生成该页所有对白片段的同步视频。"
          : "需要先有对白、插图和对白音频才可以生成对口型。没有对白的页面会跳过。"}
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--text-dark)]">待生成列表</h3>
          <span className="text-xs font-bold text-[var(--text-light)]">{readyCount} 项可生成</span>
        </div>
        {lipSyncItems.length ? (
          lipSyncItems.map((item) => {
            const blocked = !item.hasImage || !item.hasAudio;
            const active = isGenerating && (generatingPageIds === null || generatingPageIds.includes(item.pageId));
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 shadow-[var(--shadow-soft)] max-md:grid-cols-1"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-bold text-[var(--text-dark)]">{item.title}</div>
                    <StatusPill item={item} blocked={blocked} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-mid)]">{item.text}</p>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-[var(--text-light)] sm:grid-cols-3">
                    <ReadinessBadge ready={item.hasImage} label="插图" />
                    <ReadinessBadge ready={item.hasAudio} label="对白音频" />
                    <ReadinessBadge ready={item.hasLipSync} label="对白口型" />
                  </div>
                  {item.lipSyncUrl ? <AvatarVideoPreview url={item.lipSyncUrl} title={item.title} /> : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={active || isGenerating || blocked || item.hasLipSync}
                  onClick={() => onGeneratePage(item.pageId)}
                  className="min-w-[112px]"
                >
                  {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {active ? "生成中" : item.hasLipSync ? "已生成" : "生成"}
                </Button>
              </div>
            );
          })
        ) : (
          <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 text-sm text-[var(--text-light)]">
            还没有可处理的对白。
          </div>
        )}
      </div>
    </StepPanel>
  );
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 shadow-[var(--shadow-soft)]">
    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-light)]">
      <span className="text-[var(--terracotta)]">{icon}</span>
      {label}
    </div>
    <div className="mt-2 text-2xl font-bold text-[var(--text-dark)]">{value}</div>
  </div>
);

const StatusPill: React.FC<{ item: LipSyncItem; blocked: boolean }> = ({ item, blocked }) => {
  if (item.hasLipSync) {
    return <span className="rounded-full bg-[rgba(94,160,122,0.12)] px-2.5 py-1 text-xs font-bold text-[var(--sage-deep)]">已生成</span>;
  }
  if (blocked) {
    return <span className="rounded-full bg-[rgba(212,114,92,0.1)] px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">缺少素材</span>;
  }
  return <span className="rounded-full bg-[rgba(212,114,92,0.1)] px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">待生成</span>;
};

const ReadinessBadge: React.FC<{ ready: boolean; label: string }> = ({ ready, label }) => (
  <span className={`inline-flex min-w-0 items-center gap-1 rounded-lg px-2.5 py-2 ${ready ? "bg-[rgba(94,160,122,0.1)] text-[var(--sage-deep)]" : "bg-[rgba(212,114,92,0.08)] text-[var(--terracotta)]"}`}>
    {ready ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
    <span className="truncate">{label}</span>
  </span>
);

const AvatarVideoPreview: React.FC<{ url: string; title: string }> = ({ url, title }) => (
  <details className="mt-4 rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.14)] bg-[var(--warm-bg)] p-3">
    <summary className="cursor-pointer select-none text-xs font-bold text-[var(--terracotta)]">查看 avatar 视频</summary>
    <video className="mt-3 aspect-video w-full rounded-lg bg-black" controls preload="metadata" src={url} title={`${title} avatar 视频`} />
  </details>
);

const toLipSyncItems = (page: PageDraft): LipSyncItem[] =>
  page.playback_segments.filter(isDialogueSegment).map((segment) => ({
    id: `${page.id}:${segment.sort_order}`,
    pageId: page.id,
    title: `第 ${page.page_no} 页 · 对白 ${segment.sort_order}${page.title ? ` · ${page.title}` : ""}`,
    text: segment.text,
    hasImage: Boolean(page.image_url),
    hasAudio: Boolean(segment.audio_url),
    hasLipSync: Boolean(segment.lip_sync_url),
    lipSyncUrl: segment.lip_sync_url,
  }));

const isDialogueSegment = (segment: PlaybackSegmentMark) => segment.segment_type === "dialogue";
