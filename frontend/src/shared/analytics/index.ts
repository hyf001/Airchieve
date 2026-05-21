import { apiClient } from "@/shared/api/client";

export type AnalyticsActorType = "anonymous" | "user" | "admin" | "system";

export interface AnalyticsTarget {
  target_type: string;
  target_id: number;
}

export interface AnalyticsEventPayload extends AnalyticsTarget {
  event_type: string;
  actor_type?: AnalyticsActorType;
  actor_id?: number | null;
  session_id?: number | null;
  payload?: Record<string, unknown>;
  occurred_at?: string | null;
}

export const trackClientEvent = async (
  eventType: string,
  target: AnalyticsTarget,
  payload: Record<string, unknown> = {},
) => {
  await apiClient.post("/v1/analytics/events", {
    event_type: eventType,
    actor_type: "anonymous",
    ...target,
    payload,
  } satisfies AnalyticsEventPayload);
};
