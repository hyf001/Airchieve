import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArtStyle } from "@/entities/asset";
import { cn } from "@/lib/utils";
import type { CharacterCreatePayload } from "./api";
import type { CharacterCreationReference } from "./referenceStorage";

interface CharacterCreateFormProps {
  artStyles: ArtStyle[];
  className?: string;
  disabled?: boolean;
  referenceCharacter?: CharacterCreationReference | null;
  onClearReference?: () => void;
  onSubmit: (payload: CharacterCreatePayload) => Promise<boolean | void> | boolean | void;
}

export const CharacterCreateForm: React.FC<CharacterCreateFormProps> = ({ artStyles, className, disabled = false, referenceCharacter, onSubmit }) => {
  const [name, setName] = useState("");
  const [artStyleId, setArtStyleId] = useState<number | null>(null);
  const [hasPickedArtStyle, setHasPickedArtStyle] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hasPickedArtStyle && artStyleId === null && artStyles[0]?.id) {
      setArtStyleId(artStyles[0].id);
    }
  }, [artStyleId, artStyles, hasPickedArtStyle]);

  useEffect(() => {
    if (!referenceCharacter) return;
    setName(`基于${referenceCharacter.name}的新角色`);
    setPrompt(`参考${referenceCharacter.name}的外观特征，生成一个新的角色。`);
  }, [referenceCharacter]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const shouldReset = await onSubmit({
        name,
        reference_character_id: referenceCharacter?.id ?? null,
        art_style_id: artStyleId,
        custom_art_style_prompt: null,
        generation_prompt: prompt.trim() || null,
      });
      if (shouldReset !== false) {
        setName("");
        setPrompt("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={cn("app-card grid gap-4 p-5", className)} onSubmit={handleSubmit}>
      <label className="grid gap-1.5 text-sm font-semibold">
        名称
        <Input value={name} disabled={disabled || submitting} onChange={(event) => setName(event.target.value)} placeholder="小雨、妈妈、老师" required />
      </label>
      <div className="flex flex-wrap gap-2">
        {artStyles.map((style) => (
          <button
            key={style.id}
            className={`rounded-full px-3 py-2 text-xs font-bold ${
              artStyleId === style.id ? "bg-[var(--terracotta)] text-white" : "bg-[rgba(212,114,92,0.08)] text-[var(--text-mid)]"
            }`}
            disabled={disabled || submitting}
            type="button"
            onClick={() => {
              setHasPickedArtStyle(true);
              setArtStyleId(style.id);
            }}
          >
            {style.name}
          </button>
        ))}
      </div>
      <label className="grid gap-1.5 text-sm font-semibold">
        角色指令
        <textarea
          className="min-h-[96px] rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.16)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--peach)]"
          value={prompt}
          disabled={disabled || submitting}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="6 岁女孩，短发，喜欢红色裙子，活泼勇敢"
          required
        />
      </label>
      <Button disabled={disabled || submitting || !name.trim() || !prompt.trim()} type="submit">
        创建角色
      </Button>
    </form>
  );
};
