import { useCallback, useEffect, useMemo, useState } from "react";

import { taxonomyApi } from "./api";
import type { TaxonomyItem, TaxonomyType } from "./types";

type CacheEntry = { data: TaxonomyItem[]; promise?: Promise<TaxonomyItem[]> };
const cache = new Map<string, CacheEntry>();

export function useTaxonomyGroup(type: TaxonomyType) {
  const [items, setItems] = useState<TaxonomyItem[]>(() => cache.get(type)?.data ?? []);
  const [loading, setLoading] = useState(() => !cache.has(type));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = cache.get(type);
    if (cached?.data.length) {
      setItems(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const existing = cache.get(type);

    const load = async () => {
      try {
        let promise = existing?.promise;
        if (!promise) {
          promise = taxonomyApi.list(type);
          cache.set(type, { data: [], promise });
        }
        const data = await promise;
        if (cancelled) return;
        cache.set(type, { data });
        setItems(data);
        setLoading(false);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "分类加载失败");
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const labelMap = useMemo(
    () => Object.fromEntries(items.map((item) => [item.code, item.name] as const)),
    [items],
  );
  const idLabelMap = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item.name] as const)),
    [items],
  );

  const getById = useCallback(
    (id: number): TaxonomyItem | undefined => items.find((item) => item.id === id),
    [items],
  );
  const getByCode = useCallback(
    (code: string): TaxonomyItem | undefined => items.find((item) => item.code === code),
    [items],
  );

  return { items, loading, error, labelMap, idLabelMap, getById, getByCode };
}
