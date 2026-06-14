import React from "react";
import { CheckCircle2, Loader2, Mic2, PlayCircle, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { VoiceSummary } from "@/entities/asset";
import { cn } from "@/lib/utils";

import { StepPanel } from "../components";
import type { WizardPath } from "../constants";
import type { CreationSession, PageDraft, PlaybackSegmentMark } from "../types";

export interface VoiceRoleOption {
  roleCode: string;
  label: string;
  desc: string;
}

export const VoiceStep: React.FC<{
  isGenerating: boolean;
  path: WizardPath;
  roleOptions: VoiceRoleOption[];
  selectedVoicesByRole: Record<string, VoiceSummary | null>;
  session: CreationSession | null;
  voices: VoiceSummary[];
  voicesLoading: boolean;
  onGenerateAllAudio: () => void;
  onGeneratePageAudio: (pageId: number) => void;
  onSelectVoice: (roleCode: string, voice: VoiceSummary | null) => void;
}> = ({
  isGenerating,
  path,
  roleOptions,
  selectedVoicesByRole,
  session,
  voices,
  voicesLoading,
  onGenerateAllAudio,
  onGeneratePageAudio,
  onSelectVoice,
}) => {
  const activeVoices = voices.filter((voice) => voice.status === "active");
  const pages = session?.page_drafts ?? [];
  return (
    <StepPanel
      icon={<Mic2 className="h-5 w-5" />}
      title="生成语音"
      desc={path === "template" ? "可使用模板默认声音；替换声音时不改变正文、对白和播放节奏。" : "为每个配音对象设置声音，再按每页播放片段生成和试听语音。"}
    >
      <div className="space-y-5">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-[var(--text-dark)]">配音对象</h3>
            <Button type="button" size="sm" disabled={isGenerating || !session || pages.length === 0} onClick={onGenerateAllAudio}>
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
              {isGenerating ? "生成中" : "生成全部语音"}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
            {roleOptions.map((role) => {
              const voice = selectedVoicesByRole[role.roleCode] ?? null;
              const fallbackVoice = role.roleCode === "narration" ? null : selectedVoicesByRole.narration ?? null;
              return (
                <VoiceRoleCard
                  key={role.roleCode}
                  activeVoices={activeVoices}
                  fallbackVoice={fallbackVoice}
                  role={role}
                  selectedVoice={voice}
                  voicesLoading={voicesLoading}
                  onSelectVoice={(nextVoice) => onSelectVoice(role.roleCode, nextVoice)}
                />
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-[var(--text-dark)]">分镜语音</h3>
          {!session ? (
            <EmptyVoiceState title="还没有创作会话" desc="先完成前面的步骤后，这里会显示每页的播放片段。" />
          ) : pages.length === 0 ? (
            <EmptyVoiceState title="暂无分镜" desc="先在分镜步骤生成分镜，再回到这里为每个播放片段生成语音。" />
          ) : (
            <div className="grid gap-4">
              {pages.map((page) => (
                <VoicePageCard
                  key={page.id}
                  disabled={isGenerating}
                  page={page}
                  roleOptions={roleOptions}
                  selectedVoicesByRole={selectedVoicesByRole}
                  onGeneratePageAudio={() => onGeneratePageAudio(page.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </StepPanel>
  );
};

const VoiceRoleCard: React.FC<{
  activeVoices: VoiceSummary[];
  fallbackVoice: VoiceSummary | null;
  role: VoiceRoleOption;
  selectedVoice: VoiceSummary | null;
  voicesLoading: boolean;
  onSelectVoice: (voice: VoiceSummary | null) => void;
}> = ({ activeVoices, fallbackVoice, role, selectedVoice, voicesLoading, onSelectVoice }) => {
  const effectiveVoice = selectedVoice ?? fallbackVoice;
  const isInherited = !selectedVoice && !!fallbackVoice;

  return (
  <article
    className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 text-left shadow-[var(--shadow-soft)]"
  >
    <div>
      <div className="font-bold text-[var(--text-dark)]">{role.label}</div>
      <div className="mt-1 text-xs leading-5 text-[var(--text-light)]">{role.desc}</div>
    </div>

    <label className="mt-4 block text-xs font-bold text-[var(--text-light)]">
      声音
      <select
        className="mt-1 h-10 w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.12)] bg-white px-3 text-sm font-semibold text-[var(--text-mid)] outline-none focus:border-[var(--peach)]"
        disabled={voicesLoading}
        value={selectedVoice?.id ? String(selectedVoice.id) : ""}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) {
            onSelectVoice(null);
            return;
          }
          onSelectVoice(activeVoices.find((voice) => voice.id === Number(value)) ?? null);
        }}
      >
        {role.roleCode === "narration" ? <option value="">系统默认声音</option> : <option value="">沿用旁白声音</option>}
        {activeVoices.map((voice) => (
          <option key={voice.id} value={voice.id}>
            {voice.name}
          </option>
        ))}
      </select>
    </label>

    <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--warm-bg)] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--text-light)]">
        <span>{effectiveVoice?.name ?? "系统默认声音"}</span>
        {isInherited ? <span>沿用旁白</span> : null}
        {effectiveVoice?.voice_style_code ? <span>{effectiveVoice.voice_style_code}</span> : null}
        {effectiveVoice?.voice_language ? <span>{effectiveVoice.voice_language.toUpperCase()}</span> : null}
      </div>
      {effectiveVoice?.sample_url ? (
        <audio className="mt-2 h-8 w-full" controls src={effectiveVoice.sample_url} />
      ) : (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-light)]">
          <PlayCircle className="h-3.5 w-3.5" />
          暂无声音样本
        </div>
      )}
    </div>
  </article>
  );
};

const VoicePageCard: React.FC<{
  disabled: boolean;
  page: PageDraft;
  roleOptions: VoiceRoleOption[];
  selectedVoicesByRole: Record<string, VoiceSummary | null>;
  onGeneratePageAudio: () => void;
}> = ({ disabled, page, roleOptions, selectedVoicesByRole, onGeneratePageAudio }) => {
  const segments = page.playback_segments.length ? [...page.playback_segments].sort((first, second) => first.sort_order - second.sort_order) : fallbackSegments(page);
  const readyCount = segments.filter((segment) => segment.audio_url).length;

  return (
    <article className="rounded-[var(--radius-md)] border border-[rgba(212,114,92,0.1)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[rgba(212,114,92,0.08)] px-2.5 py-1 text-xs font-bold text-[var(--terracotta)]">第 {page.page_no} 页</span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", statusClassName(page.audio_status))}>{statusLabel(page.audio_status)}</span>
            {readyCount ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(94,160,122,0.1)] px-2.5 py-1 text-xs font-bold text-[var(--sage-deep)]">
                <CheckCircle2 className="h-3 w-3" />
                {readyCount}/{segments.length} 段可试听
              </span>
            ) : null}
          </div>
          <h4 className="mt-3 text-base font-bold text-[var(--text-dark)]">{page.title || "未命名分镜"}</h4>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={disabled || segments.length === 0} onClick={onGeneratePageAudio}>
          {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
          {readyCount ? "重新生成本页" : "生成本页语音"}
        </Button>
      </div>

      {segments.length ? (
        <div className="mt-4 grid gap-3">
          {segments.map((segment, index) => (
            <VoiceSegmentCard
              key={`${segment.sort_order}-${index}`}
              index={index}
              roleOptions={roleOptions}
              segment={segment}
              selectedVoicesByRole={selectedVoicesByRole}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--warm-bg)] p-4 text-sm leading-6 text-[var(--text-light)]">
          当前页面没有可配音文本。
        </p>
      )}
    </article>
  );
};

const VoiceSegmentCard: React.FC<{
  index: number;
  roleOptions: VoiceRoleOption[];
  segment: PlaybackSegmentMark;
  selectedVoicesByRole: Record<string, VoiceSummary | null>;
}> = ({ index, roleOptions, segment, selectedVoicesByRole }) => {
  const roleCode = segment.segment_type === "dialogue" ? segment.speaker_ref ?? "" : "narration";
  const role = roleOptions.find((item) => item.roleCode === roleCode);
  const voice = selectedVoicesByRole[roleCode] ?? selectedVoicesByRole.narration ?? null;

  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--warm-bg)] p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--text-light)]">
        <span>{index + 1}</span>
        <span>{segment.segment_type === "dialogue" ? "对白" : "旁白"}</span>
        <span>{role?.label ?? segment.speaker_ref ?? "旁白"}</span>
        <span>{voice ? `声音：${voice.name}` : "系统默认声音"}</span>
        {segment.audio_url ? <span className="text-[var(--sage-deep)]">已生成</span> : <span>未生成</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--text-mid)]">{segment.text}</p>
      {segment.audio_url ? <audio className="mt-3 h-9 w-full" controls src={segment.audio_url} /> : null}
    </div>
  );
};

const EmptyVoiceState: React.FC<{ title: string; desc: string }> = ({ title, desc }) => (
  <div className="rounded-[var(--radius-md)] border border-dashed border-[rgba(212,114,92,0.2)] bg-[var(--warm-bg)] p-5 text-sm">
    <div className="flex items-start gap-3 text-[var(--text-mid)]">
      <div className="rounded-[var(--radius-sm)] bg-white p-2 text-[var(--terracotta)] shadow-[var(--shadow-soft)]">
        <Mic2 className="h-5 w-5" />
      </div>
      <div>
        <h4 className="font-bold text-[var(--text-dark)]">{title}</h4>
        <p className="mt-1 leading-6 text-[var(--text-light)]">{desc}</p>
      </div>
    </div>
  </div>
);

const fallbackSegments = (page: PageDraft): PlaybackSegmentMark[] => {
  const text = page.text_zh || page.text_en || "";
  if (!text.trim()) return [];
  return [
    {
      segment_type: "narration",
      text,
      sort_order: 1,
      audio_url: page.audio_url,
      audio_asset_id: page.audio_asset_id,
    },
  ];
};

const statusLabel = (status: PageDraft["audio_status"]) => {
  if (status === "pending") return "生成中";
  if (status === "ready") return "已生成";
  if (status === "failed") return "生成失败";
  if (status === "skipped") return "已跳过";
  return "待生成";
};

const statusClassName = (status: PageDraft["audio_status"]) => {
  if (status === "pending") return "bg-[rgba(126,200,227,0.14)] text-[var(--sky-deep)]";
  if (status === "ready") return "bg-[rgba(94,160,122,0.12)] text-[var(--sage-deep)]";
  if (status === "failed") return "bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)]";
  return "bg-[rgba(120,120,120,0.1)] text-[var(--text-light)]";
};
