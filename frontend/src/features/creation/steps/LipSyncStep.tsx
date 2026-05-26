import React from "react";
import { Clapperboard, Image, Mic2, Video } from "lucide-react";

import { StepPanel } from "../components";
import type { CreationSession } from "../types";

export const LipSyncStep: React.FC<{ session: CreationSession | null }> = ({ session }) => {
  const pages = session?.page_drafts ?? [];
  const imageCount = pages.filter((page) => page.image_url).length;
  const audioCount = pages.filter((page) => page.audio_url).length;
  const lipSyncCount = pages.filter((page) => page.lip_sync_url).length;
  const canGenerate = pages.length > 0 && imageCount > 0 && audioCount > 0;

  return (
    <StepPanel icon={<Clapperboard className="h-5 w-5" />} title="对口型" desc="可选生成角色口型同步视频；跳过后仍可保存有插图和音频的绘本。">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Image className="h-4 w-4" />} label="已有插图" value={`${imageCount}/${pages.length || 0}`} />
        <MetricCard icon={<Mic2 className="h-4 w-4" />} label="已有音频" value={`${audioCount}/${pages.length || 0}`} />
        <MetricCard icon={<Video className="h-4 w-4" />} label="已同步口型" value={`${lipSyncCount}/${pages.length || 0}`} />
      </div>

      <div className="mt-5 rounded-[var(--radius-md)] bg-[var(--warm-bg)] p-4 text-sm leading-6 text-[var(--text-mid)]">
        {canGenerate
          ? "对口型会基于每页插图和音频生成同步结果，适合有角色对白或希望播放更生动的绘本。"
          : "需要先有插图和音频才可以生成对口型。当前仍可跳过，直接进入预览保存。"}
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
