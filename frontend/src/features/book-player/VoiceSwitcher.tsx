import React from "react";
import { Mic2 } from "lucide-react";

import { type BookVoiceOption } from "@/entities/book";

interface VoiceSwitcherProps {
  voices: BookVoiceOption[];
  currentVoice: BookVoiceOption | null;
  onChange: (voice: BookVoiceOption) => void;
}

export const VoiceSwitcher: React.FC<VoiceSwitcherProps> = ({ voices, currentVoice, onChange }) => (
  <label className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-white px-3 py-2 text-sm font-semibold shadow-[var(--shadow-soft)]">
    <Mic2 className="h-4 w-4 text-[var(--terracotta)]" />
    <span className="text-[var(--text-light)]">声音</span>
    <select
      className="bg-transparent text-[var(--text-dark)] outline-none"
      value={currentVoice?.name ?? ""}
      onChange={(event) => {
        const voice = voices.find((item) => item.name === event.target.value);
        if (voice) onChange(voice);
      }}
      aria-label="选择朗读声音"
    >
      {voices.map((voice) => (
        <option key={`${voice.source}-${voice.id ?? voice.name}`} value={voice.name}>
          {voice.name}
        </option>
      ))}
    </select>
  </label>
);
