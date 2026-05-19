import { useEffect, useState } from "react";

import type { UserEntitlements } from "@/entities/membership";
import { membershipApi } from "./api";

let cachedEntitlements: UserEntitlements | null = null;
let pendingEntitlements: Promise<UserEntitlements> | null = null;

const loadEntitlements = () => {
  if (cachedEntitlements) return Promise.resolve(cachedEntitlements);
  pendingEntitlements ??= membershipApi.getEntitlements().then((value) => {
    cachedEntitlements = value;
    pendingEntitlements = null;
    return value;
  }).catch((error: unknown) => {
    pendingEntitlements = null;
    throw error;
  });
  return pendingEntitlements;
};

export const useEntitlements = () => {
  const [data, setData] = useState<UserEntitlements | null>(cachedEntitlements);
  const [loading, setLoading] = useState(cachedEntitlements === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadEntitlements()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "权益信息加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
};
