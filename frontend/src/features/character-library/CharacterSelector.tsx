import React from "react";
import { Sparkles, UserRound } from "lucide-react";

import { AssetCard, type CharacterSummary } from "@/entities/asset";

interface CharacterSelectorProps {
  characters: CharacterSummary[];
  selectedId?: number | null;
  onSelect: (character: CharacterSummary) => void;
  onSetDefault?: (character: CharacterSummary) => void;
  onDelete?: (character: CharacterSummary) => void;
}

export const CharacterSelector: React.FC<CharacterSelectorProps> = ({ characters, selectedId, onSelect, onSetDefault, onDelete }) => (
  <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
    {characters.map((character) => (
      <AssetCard
        key={character.id}
        title={character.name}
        subtitle={character.identity_tag ?? character.custom_art_style_prompt ?? "角色"}
        imageUrl={character.image_url}
        icon={character.source_type === "system" ? <Sparkles /> : <UserRound />}
        accessLevel={character.access_level}
        selected={selectedId === character.id}
        isDefault={character.is_default}
        onSelect={() => onSelect(character)}
        onSetDefault={character.owner_user_id ? () => onSetDefault?.(character) : undefined}
        onDelete={character.owner_user_id ? () => onDelete?.(character) : undefined}
      />
    ))}
  </div>
);
