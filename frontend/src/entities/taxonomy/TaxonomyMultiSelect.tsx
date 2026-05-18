import React from "react";

import { cn } from "@/lib/utils";

import { useTaxonomyGroup } from "./useTaxonomyGroup";
import type { TaxonomyType } from "./types";

interface TaxonomyMultiSelectProps {
  type: TaxonomyType;
  value: string[];
  onChange: (codes: string[]) => void;
  className?: string;
}

export const TaxonomyMultiSelect: React.FC<TaxonomyMultiSelectProps> = ({ type, value, onChange, className }) => {
  const { items, loading } = useTaxonomyGroup(type);

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((v) => v !== code) : [...value, code]);
  };

  if (loading) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className="inline-block h-8 w-16 animate-pulse rounded-full bg-[var(--cream)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => {
        const selected = value.includes(item.code);
        return (
          <button
            key={item.code}
            className={cn(
              "rounded-full border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-all",
              selected
                ? "border-[var(--honey)] bg-[rgba(245,166,35,0.1)] text-[#D4882A]"
                : "border-[rgba(212,114,92,0.12)] bg-white text-[var(--text-mid)] hover:border-[var(--honey)]",
            )}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(item.code)}
          >
            {selected ? "✓ " : ""}
            {item.name}
          </button>
        );
      })}
    </div>
  );
};
