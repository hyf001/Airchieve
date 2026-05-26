import React from "react";
import { Palette } from "lucide-react";

import type { ArtStyle } from "@/entities/asset";

import { SelectableTile, StepPanel } from "../components";

export const StyleStep: React.FC<{
  artStyles: ArtStyle[];
  artStylesLoading: boolean;
  selectedArtStyleId: number | null;
  onSelectArtStyle: (artStyle: ArtStyle) => void;
}> = ({ artStyles, artStylesLoading, selectedArtStyleId, onSelectArtStyle }) => (
  <StepPanel icon={<Palette className="h-5 w-5" />} title="确定画风" desc="先确定统一画风，再从该画风下选择角色形象，避免多个角色画风不一致。">
    {artStylesLoading ? <div className="app-card p-5 text-sm text-[var(--text-light)]">正在加载画风...</div> : null}
    {!artStylesLoading && artStyles.length === 0 ? <div className="app-card p-5 text-sm text-[var(--text-light)]">暂无可用画风，请先到画风库配置。</div> : null}
    {artStyles.length ? (
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
        {artStyles.map((artStyle) => (
          <SelectableTile
            key={artStyle.id}
            selected={selectedArtStyleId === artStyle.id}
            title={artStyle.name}
            desc={artStyle.description || artStyle.code || "可用于本次绘本创作"}
            onClick={() => onSelectArtStyle(artStyle)}
          />
        ))}
      </div>
    ) : null}
  </StepPanel>
);
