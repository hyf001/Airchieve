import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArtStyle } from "@/entities/asset";
import type { CharacterCreatePayload } from "./api";

interface CharacterCreateFormProps {
  artStyles: ArtStyle[];
  onSubmit: (payload: CharacterCreatePayload) => Promise<void> | void;
}

export const CharacterCreateForm: React.FC<CharacterCreateFormProps> = ({ artStyles, onSubmit }) => {
  const [name, setName] = useState("");
  const [identityTag, setIdentityTag] = useState("");
  const [artStyleId, setArtStyleId] = useState<number | null>(artStyles[0]?.id ?? null);
  const [customStyle, setCustomStyle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        identity_tag: identityTag || null,
        art_style_id: artStyleId,
        custom_art_style_prompt: artStyleId ? null : customStyle,
        generation_prompt: prompt,
        age_range_codes: [],
      });
      setName("");
      setIdentityTag("");
      setPrompt("");
      setCustomStyle("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="app-card grid gap-4 p-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <label className="grid gap-1.5 text-sm font-semibold">
          名称
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="小雨、妈妈、老师" required />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          身份标签
          <Input value={identityTag} onChange={(event) => setIdentityTag(event.target.value)} placeholder="女儿、家人、同学" />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {artStyles.map((style) => (
          <button
            key={style.id}
            className={`rounded-full px-3 py-2 text-xs font-bold ${
              artStyleId === style.id ? "bg-[var(--terracotta)] text-white" : "bg-[rgba(212,114,92,0.08)] text-[var(--text-mid)]"
            }`}
            type="button"
            onClick={() => setArtStyleId(style.id)}
          >
            {style.name}
          </button>
        ))}
        <button
          className={`rounded-full px-3 py-2 text-xs font-bold ${
            artStyleId === null ? "bg-[var(--terracotta)] text-white" : "bg-[rgba(212,114,92,0.08)] text-[var(--text-mid)]"
          }`}
          type="button"
          onClick={() => setArtStyleId(null)}
        >
          自定义画风
        </button>
      </div>
      {artStyleId === null ? (
        <Input value={customStyle} onChange={(event) => setCustomStyle(event.target.value)} placeholder="温暖手绘、水粉质感、适合低龄儿童" required />
      ) : null}
      <label className="grid gap-1.5 text-sm font-semibold">
        形象指令
        <textarea
          className="min-h-[96px] rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.16)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--peach)]"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="6 岁女孩，短发，喜欢红色裙子，活泼勇敢"
          required
        />
      </label>
      <Button disabled={submitting || !name || !prompt} type="submit">
        创建角色形象
      </Button>
    </form>
  );
};
