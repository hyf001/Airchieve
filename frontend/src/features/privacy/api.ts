import { apiClient } from "@/shared/api/client";

export const privacyApi = {
  recordUploadConsent: (payload: {
    target_type: "story" | "character_reference_image" | "voice_sample" | "upload_file";
    target_id?: number | null;
    consent_text_version?: string;
    confirmed_rights: boolean;
    confirmed_privacy: boolean;
  }) => apiClient.post<{ id: number }>("/v1/privacy/upload-consents", payload),
};
