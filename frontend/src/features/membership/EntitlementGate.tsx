import React from "react";

import { UpgradePrompt } from "@/entities/membership";
import { useEntitlements } from "./useEntitlements";

interface EntitlementGateProps {
  children: React.ReactNode;
  requiresMember?: boolean;
  fallback?: React.ReactNode;
}

export const EntitlementGate: React.FC<EntitlementGateProps> = ({ children, requiresMember = true, fallback }) => {
  const { data, loading } = useEntitlements();
  if (loading) return null;
  if (requiresMember && data?.access_level !== "member") {
    return <>{fallback ?? <UpgradePrompt />}</>;
  }
  return <>{children}</>;
};
