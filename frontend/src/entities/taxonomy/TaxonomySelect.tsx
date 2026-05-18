import React from "react";

import { cn } from "@/lib/utils";

import { useTaxonomyGroup } from "./useTaxonomyGroup";
import type { TaxonomyType } from "./types";

interface TaxonomySelectProps {
  type: TaxonomyType;
  value: string | null;
  onChange: (code: string | null) => void;
  placeholder?: string;
  className?: string;
}

export const TaxonomySelect: React.FC<TaxonomySelectProps> = ({
  type,
  value,
  onChange,
  placeholder = "请选择",
  className,
}) => {
  const { items, loading } = useTaxonomyGroup(type);

  return (
    <select
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] border-[1.5px] border-[rgba(212,114,92,0.15)] bg-white px-3 text-sm text-[var(--text-dark)] outline-none focus:border-[var(--honey)] focus:ring-4 focus:ring-[rgba(245,166,35,0.1)]",
        className,
      )}
      disabled={loading}
      value={value ?? ""}
      onChange={(event) => {
        const v = event.target.value;
        onChange(v === "" ? null : v);
      }}
    >
      <option value="">{loading ? "加载中..." : placeholder}</option>
      {items.map((item) => (
        <option key={item.code} value={item.code}>
          {item.name}
        </option>
      ))}
    </select>
  );
};
