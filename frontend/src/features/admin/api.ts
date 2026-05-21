import { apiClient } from "@/shared/api/client";
import type { AdminContentOverviewRead, AdminDashboardRead } from "./types";

export const adminApi = {
  getDashboard: () => apiClient.get<AdminDashboardRead>("/v1/admin/dashboard"),
  getContentOverview: () => apiClient.get<AdminContentOverviewRead>("/v1/admin/content/overview"),
};
