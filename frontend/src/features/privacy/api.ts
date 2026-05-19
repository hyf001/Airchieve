import { apiClient } from "@/shared/api/client";

export type PrivacyAction = "share" | "export";

export interface PrivacyFlags {
  target_type: string;
  target_id: number;
  risk_flags: string[];
  requires_confirmation: boolean;
  latest_confirmation_id: number | null;
  visibility: "private" | "shared_link" | "public" | "system";
  deletion_policy: "soft_delete" | "retain_snapshot";
}

export const privacyApi = {
  recordUploadConsent: (payload: {
    target_type: "story" | "character_reference_image" | "voice_sample" | "upload_file";
    target_id?: number | null;
    consent_text_version?: string;
    confirmed_rights: boolean;
    confirmed_privacy: boolean;
  }) => apiClient.post<{ id: number }>("/v1/privacy/upload-consents", payload),
  getFlags: (targetType: string, targetId: number, action: PrivacyAction) =>
    apiClient.get<PrivacyFlags>(`/v1/privacy/flags?target_type=${encodeURIComponent(targetType)}&target_id=${targetId}&action=${action}`),
  recordPrivacyConfirmation: (payload: {
    action: PrivacyAction;
    target: { target_type: string; target_id: number };
    risk_flags: string[];
    confirmation_text_version?: string;
  }) => apiClient.post<{ id: number }>("/v1/privacy/confirmations", payload),
};
