import React from "react";
import { Crown, Search, Sparkles, UserRound, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CharacterSummary } from "@/entities/asset";
import type { StoryCharacter } from "@/entities/story";
import { cn } from "@/lib/utils";

import { StepPanel } from "../components";
import type { WizardPath } from "../constants";

type CharacterSourceFilter = "all" | "system" | "custom";
type CharacterSelectionMap = Record<string, CharacterSummary | null>;

export const CharacterStep: React.FC<{
  assetCharacters: CharacterSummary[];
  charactersLoading: boolean;
  page: number;
  query: string;
  selectedRoleCode: string | null;
  selectedCharactersByRole: CharacterSelectionMap;
  sourceFilter: CharacterSourceFilter;
  storyCharacters: StoryCharacter[];
  total: number;
  totalPages: number;
  path: WizardPath;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onSelectAssetCharacter: (character: CharacterSummary | null) => void;
  onSelectStoryRole: (roleCode: string) => void;
  onSourceFilterChange: (value: CharacterSourceFilter) => void;
}> = ({
  assetCharacters,
  charactersLoading,
  page,
  path,
  query,
  selectedRoleCode,
  selectedCharactersByRole,
  sourceFilter,
  storyCharacters,
  total,
  totalPages,
  onPageChange,
  onQueryChange,
  onSelectAssetCharacter,
  onSelectStoryRole,
  onSourceFilterChange,
}) => {
  const activeRoleCode = selectedRoleCode ?? roleCodeFor(storyCharacters[0], 0);
  const activeSelection = selectedCharactersByRole[activeRoleCode] ?? null;

  return (
    <StepPanel
      icon={<UserRound className="h-5 w-5" />}
      title={path === "template" ? "替换模板角色" : "选择故事角色形象"}
      desc={path === "template" ? "为模板角色选择系统角色或你的自定义角色；每个角色也可以不指定形象。" : "根据故事里的角色逐个选择形象；不选择时由 AI 按故事描述生成。"}
    >
      <div className="grid grid-cols-[260px_1fr] gap-5 max-lg:grid-cols-1">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[var(--text-dark)]">故事角色</h3>
          {storyCharacters.length ? (
            storyCharacters.map((character, index) => {
              const roleCode = roleCodeFor(character, index);
              const selectedAsset = selectedCharactersByRole[roleCode] ?? null;
              return (
                <button
                  key={roleCode}
                  type="button"
                  className={cn(
                    "w-full rounded-[var(--radius-md)] border bg-white p-4 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5",
                    activeRoleCode === roleCode ? "border-[var(--terracotta)] shadow-[0_0_0_3px_rgba(212,114,92,0.12)]" : "border-[rgba(212,114,92,0.08)]",
                  )}
                  onClick={() => onSelectStoryRole(roleCode)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg text-[var(--text-dark)]">{character.name}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--text-light)]">{character.is_protagonist ? "主角" : "角色"}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[rgba(126,200,227,0.14)] px-2 py-1 text-xs font-bold text-[var(--sky-deep)]">
                      {selectedAsset ? "已选形象" : "AI生成"}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-1 text-xs text-[var(--text-light)]">{selectedAsset?.name ?? "未绑定形象"}</p>
                </button>
              );
            })
          ) : (
            <div className="rounded-[var(--radius-md)] bg-white p-4 text-sm leading-6 text-[var(--text-light)] shadow-[var(--shadow-soft)]">
              这个故事还没有角色定义，后续会按故事文本生成角色。
            </div>
          )}
        </section>

        <section className="space-y-5">
          <NoCharacterChoiceCard selected={activeSelection === null} onSelect={() => onSelectAssetCharacter(null)} />

          <div className="grid grid-cols-[1fr_180px] gap-3 max-sm:grid-cols-1">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
              <input
                className="h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--honey)]"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="搜索角色名称、身份或描述"
              />
            </label>
            <select
              className="h-10 rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm outline-none focus:border-[var(--honey)]"
              value={sourceFilter}
              onChange={(event) => onSourceFilterChange(event.target.value as CharacterSourceFilter)}
            >
              <option value="all">全部角色</option>
              <option value="system">系统角色</option>
              <option value="custom">我的角色</option>
            </select>
          </div>

          {charactersLoading ? <div className="app-card p-5 text-sm text-[var(--text-light)]">正在加载角色...</div> : null}
          {!charactersLoading && assetCharacters.length === 0 ? <div className="app-card p-5 text-sm text-[var(--text-light)]">当前画风和筛选下暂无可用角色形象，可为故事角色选择“不指定形象”，由 AI 按统一画风生成。</div> : null}
          {assetCharacters.length ? (
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
              {assetCharacters.map((character) => (
                <CharacterChoiceCard
                  key={character.id}
                  character={character}
                  selected={activeSelection?.id === character.id}
                  onSelect={() => onSelectAssetCharacter(activeSelection?.id === character.id ? null : character)}
                />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-light)]">
            <span>
              共 {total} 个形象，第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                上一页
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                下一页
              </Button>
            </div>
          </div>
        </section>
      </div>
    </StepPanel>
  );
};

export const roleCodeFor = (character: StoryCharacter | undefined, index: number) => `story_role_${index}_${character?.name ?? "character"}`;

const NoCharacterChoiceCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
}> = ({ selected, onSelect }) => (
  <button
    type="button"
    className={cn(
      "flex w-full items-start gap-4 rounded-[20px] border-[2.5px] bg-white p-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
      selected ? "border-[var(--terracotta)] shadow-[0_0_0_3px_rgba(212,114,92,0.12),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
    )}
    onClick={onSelect}
  >
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[rgba(139,198,168,0.16)] text-[var(--sage-deep)]">
      <Wand2 className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block font-display text-xl text-[var(--text-dark)]">不指定形象</span>
      <span className="mt-1 block text-sm leading-6 text-[var(--text-mid)]">这个故事角色会由 AI 按故事描述生成形象。</span>
    </span>
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", selected ? "bg-[rgba(212,114,92,0.12)] text-[var(--terracotta)]" : "bg-[rgba(126,200,227,0.14)] text-[var(--sky-deep)]")}>
      {selected ? "已选择" : "可选择"}
    </span>
  </button>
);

const CharacterChoiceCard: React.FC<{
  character: CharacterSummary;
  selected: boolean;
  onSelect: () => void;
}> = ({ character, selected, onSelect }) => {
  const isSystem = character.owner_user_id === null;
  const isGenerating = !character.image_url && (character.generation_status === "queued" || character.generation_status === "running");
  const isUnavailable = character.status !== "active" || character.moderation_status === "rejected" || character.generation_status === "failed";

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[20px] border-[2.5px] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
        selected ? "border-[var(--terracotta)] shadow-[0_0_0_3px_rgba(212,114,92,0.12),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
        isUnavailable ? "opacity-70" : "",
      )}
    >
      <button className="block flex-1 text-left disabled:cursor-not-allowed" type="button" disabled={isUnavailable} onClick={onSelect}>
        <div className="relative flex h-[180px] items-center justify-center overflow-hidden bg-[linear-gradient(135deg,rgba(245,166,35,0.16),rgba(139,198,168,0.18))]">
          {character.image_url ? (
            <img alt={character.name} className="h-full w-full object-cover" src={character.image_url} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-[var(--terracotta)]">
              {isSystem ? <Sparkles className="h-10 w-10" /> : <UserRound className="h-10 w-10" />}
              {isGenerating ? <span className="mt-3 text-xs font-bold text-[var(--text-light)]">生成中</span> : null}
            </div>
          )}
          <div className="absolute left-3.5 top-3.5 flex flex-wrap items-center gap-2">
            <Badge>{isSystem ? "系统角色" : "我的角色"}</Badge>
            {character.is_default ? <Badge>默认</Badge> : null}
            {character.access_level === "vip" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--honey)]">
                <Crown className="h-3 w-3" />
                VIP
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl text-[var(--text-dark)]">{character.name}</h3>
              <p className="mt-1 truncate text-xs font-bold text-[var(--text-light)]">
                {character.identity_tag ?? character.art_style_code ?? character.custom_art_style_prompt ?? "角色"}
              </p>
            </div>
            <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", selected ? "bg-[rgba(212,114,92,0.12)] text-[var(--terracotta)]" : "bg-[rgba(126,200,227,0.14)] text-[var(--sky-deep)]")}>
              {selected ? "已选择" : "可选择"}
            </span>
          </div>
          <p className="mt-3 line-clamp-3 min-h-[72px] text-[13px] leading-6 text-[var(--text-mid)]">
            {character.description ?? character.custom_art_style_prompt ?? "暂无角色描述"}
          </p>
        </div>
      </button>
    </article>
  );
};

const Badge: React.FC<React.PropsWithChildren> = ({ children }) => (
  <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-[var(--text-mid)]">{children}</span>
);
