import React, { useEffect, useState } from "react";
import { Paintbrush } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArtStyle } from "@/entities/asset";
import { artStyleLibraryApi, ArtStyleSelector } from "@/features/art-style-library";
import { AppShell } from "@/shared/layout/AppShell";

export const ArtStylesPage: React.FC = () => {
  const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = () => {
    void artStyleLibraryApi.list().then((response) => setArtStyles(response.items)).catch(() => setArtStyles([]));
  };

  useEffect(load, []);

  const handleCreateCustom = async () => {
    if (!name || !description) return;
    const style = await artStyleLibraryApi.createCustom({ name, description, prompt: description });
    setSelectedId(style.id);
    setName("");
    setDescription("");
    load();
  };

  return (
    <AppShell>
      <section className="mx-auto max-w-[1320px] px-8 py-8 max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">画风</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">选择系统画风，或创建自定义画风描述，用于生成新的角色形象。</p>
          </div>
          <Button onClick={() => document.getElementById("custom-style")?.scrollIntoView({ behavior: "smooth" })}>
            <Paintbrush className="h-4 w-4" />
            自定义画风
          </Button>
        </div>

        <section className="mt-6">
          {artStyles.length ? (
            <ArtStyleSelector artStyles={artStyles} selectedId={selectedId} onSelect={(style) => setSelectedId(style.id)} />
          ) : (
            <div className="app-card p-6 text-sm text-[var(--text-light)]">画风库暂无数据，管理员配置后会展示在这里。</div>
          )}
        </section>

        <section className="app-card mt-8 grid gap-4 p-5" id="custom-style">
          <h2 className="font-display text-2xl">自定义画风</h2>
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <label className="grid gap-1.5 text-sm font-semibold">
              名称
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="温暖水粉、睡前柔光" />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              描述
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="柔和色彩，适合 3-6 岁儿童" />
            </label>
          </div>
          <Button className="w-fit" disabled={!name || !description} onClick={handleCreateCustom}>
            保存自定义画风
          </Button>
        </section>
      </section>
    </AppShell>
  );
};
