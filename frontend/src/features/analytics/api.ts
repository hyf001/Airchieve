import { apiClient } from "@/shared/api/client";
import type { OperationDashboard } from "./types";

export const analyticsApi = {
  getDashboard: () => apiClient.get<OperationDashboard>("/v1/admin/analytics/dashboard"),
};
