import React from "react";
import { Paintbrush } from "lucide-react";

import { AssetCard, type ArtStyle } from "@/entities/asset";

interface ArtStyleSelectorProps {
  artStyles: ArtStyle[];
  selectedId?: number | null;
  onSelect: (style: ArtStyle) => void;
}

export const ArtStyleSelector: React.FC<ArtStyleSelectorProps> = ({ artStyles, selectedId, onSelect }) => (
  <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">
    {artStyles.map((style) => (
      <AssetCard
        key={style.id}
        title={style.name}
        subtitle={style.description}
        imageUrl={style.example_url}
        icon={<Paintbrush />}
        accessLevel={style.access_level}
        selected={selectedId === style.id}
        onSelect={() => onSelect(style)}
      />
    ))}
  </div>
);
