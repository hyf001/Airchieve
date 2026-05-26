import React from "react";
import { Mic2, PlayCircle, UserRound } from "lucide-react";

import type { VoiceSummary } from "@/entities/asset";

import { SelectableTile, StepPanel } from "../components";
import type { WizardPath } from "../constants";

export interface VoiceRoleOption {
  roleCode: string;
  label: string;
  desc: string;
}

export const VoiceStep: React.FC<{
  path: WizardPath;
  roleOptions: VoiceRoleOption[];
  selectedRoleCode: string;
  selectedVoiceId: number | null;
  voices: VoiceSummary[];
  voicesLoading: boolean;
  onSelectRole: (roleCode: string) => void;
  onSelectVoice: (voice: VoiceSummary | null) => void;
}> = ({ path, roleOptions, selectedRoleCode, selectedVoiceId, voices, voicesLoading, onSelectRole, onSelectVoice }) => {
  const activeVoices = voices.filter((voice) => voice.status === "active");

  return (
    <StepPanel
      icon={<Mic2 className="h-5 w-5" />}
      title="选择朗读声音"
      desc={path === "template" ? "可使用模板默认声音；替换声音时不改变正文、对白和播放节奏。" : "选择要配音的旁白或角色，再选择本次生成使用的声音。"}
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-3 text-sm font-bold text-[var(--text-dark)]">配音对象</h3>
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
            {roleOptions.map((role) => (
              <SelectableTile
                key={role.roleCode}
                selected={selectedRoleCode === role.roleCode}
                title={role.label}
                desc={role.desc}
                onClick={() => onSelectRole(role.roleCode)}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold text-[var(--text-dark)]">声音</h3>
          {path === "template" ? (
            <button
              type="button"
              className={`mb-3 w-full rounded-[var(--radius-md)] border bg-white p-4 text-left transition hover:-translate-y-0.5 ${
                selectedVoiceId === null ? "border-[var(--terracotta)] shadow-[var(--shadow-hover)]" : "border-[rgba(212,114,92,0.1)] shadow-[var(--shadow-soft)]"
              }`}
              onClick={() => onSelectVoice(null)}
            >
              <div className="font-bold text-[var(--text-dark)]">模板默认声音</div>
              <div className="mt-1 text-xs text-[var(--text-light)]">沿用模板配置，不改变原播放节奏</div>
            </button>
          ) : null}

          {voicesLoading ? (
            <div className="rounded-[var(--radius-md)] bg-[var(--warm-bg)] p-4 text-sm text-[var(--text-light)]">正在加载声音...</div>
          ) : activeVoices.length ? (
            <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
              {activeVoices.map((voice) => (
                <button
                  key={voice.id}
                  type="button"
                  className={`rounded-[var(--radius-md)] border bg-white p-4 text-left transition hover:-translate-y-0.5 ${
                    selectedVoiceId === voice.id ? "border-[var(--terracotta)] shadow-[var(--shadow-hover)]" : "border-[rgba(212,114,92,0.1)] shadow-[var(--shadow-soft)]"
                  }`}
                  onClick={() => onSelectVoice(voice)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[var(--text-dark)]">{voice.name}</div>
                      <div className="mt-1 text-xs text-[var(--text-light)]">
                        {voice.owner_user_id === null ? "系统声音" : "个人声音"}
                        {voice.voice_style_code ? ` · ${voice.voice_style_code}` : ""}
                      </div>
                    </div>
                    {voice.sample_url ? <PlayCircle className="h-4 w-4 shrink-0 text-[var(--sage-deep)]" /> : <UserRound className="h-4 w-4 shrink-0 text-[var(--text-light)]" />}
                  </div>
                  {voice.sample_url ? <audio className="mt-3 h-8 w-full" controls src={voice.sample_url} /> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-md)] bg-[var(--warm-bg)] p-4 text-sm text-[var(--text-light)]">
              暂无可用声音，将使用系统默认声音生成。
            </div>
          )}
        </section>
      </div>
    </StepPanel>
  );
};
