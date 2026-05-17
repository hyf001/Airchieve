import React, { useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type StoryPayload } from "./types";

interface StoryEditorProps {
  onSubmit: (payload: StoryPayload) => Promise<void> | void;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({ onSubmit }) => {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        summary: summary || null,
        body,
        source_type: "uploaded",
        language: "zh",
      });
      setTitle("");
      setSummary("");
      setBody("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="app-card space-y-4 p-5" onSubmit={handleSubmit}>
      <div>
        <h2 className="font-display text-2xl">保存我的故事</h2>
        <p className="mt-1 text-sm text-[var(--text-light)]">请只上传或粘贴你有权使用的纯文本故事。</p>
      </div>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="故事标题" required maxLength={160} />
      <Input value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="一句话简介" maxLength={1000} />
      <textarea
        className="min-h-[180px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.15)] bg-white px-4 py-3 text-sm outline-none transition-all placeholder:text-[var(--text-light)] focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="粘贴故事正文，MVP 最多 3000 字"
        required
        maxLength={3000}
      />
      <Button type="submit" disabled={submitting || !title || !body}>
        <Save className="h-4 w-4" />
        保存故事
      </Button>
    </form>
  );
};
