import React from "react";
import { Mic2 } from "lucide-react";

import { AssetCard, type VoiceSummary } from "@/entities/asset";

interface VoiceSelectorProps {
  voices: VoiceSummary[];
  selectedId?: number | null;
  onSelect: (voice: VoiceSummary) => void;
  onSetDefault?: (voice: VoiceSummary) => void;
  onDelete?: (voice: VoiceSummary) => void;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedId, onSelect, onSetDefault, onDelete }) => (
  <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
    {voices.map((voice) => (
      <AssetCard
        key={voice.id}
        title={voice.name}
        subtitle={[voice.voice_style_code, voice.duration_seconds ? `${voice.duration_seconds} 秒` : null].filter(Boolean).join(" · ")}
        icon={<Mic2 />}
        accessLevel={voice.access_level}
        selected={selectedId === voice.id}
        isDefault={voice.is_default}
        onSelect={() => onSelect(voice)}
        onPreview={() => undefined}
        onSetDefault={voice.owner_user_id ? () => onSetDefault?.(voice) : undefined}
        onDelete={voice.owner_user_id ? () => onDelete?.(voice) : undefined}
      />
    ))}
  </div>
);
