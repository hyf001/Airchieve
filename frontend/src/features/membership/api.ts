import type { MembershipPlan, UserEntitlements, UserMembership } from "@/entities/membership";
import { apiClient } from "@/shared/api/client";

export const membershipApi = {
  listPlans: () => apiClient.get<MembershipPlan[]>("/v1/membership/plans"),
  getMe: () => apiClient.get<UserMembership>("/v1/membership/me"),
  getEntitlements: () => apiClient.get<UserEntitlements>("/v1/membership/entitlements"),
};
