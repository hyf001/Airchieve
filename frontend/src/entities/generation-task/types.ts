export type GenerationTaskStatusValue = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface GenerationTaskRead {
  id: number;
  task_type: "story" | "storyboard" | "character_image" | "image" | "audio" | "lip_sync" | "template_composite" | "pdf_export";
  owner_type: string;
  owner_id: number;
  user_id?: number | null;
  status: GenerationTaskStatusValue;
  progress_percent: number;
  result_refs?: Record<string, unknown> | null;
  error_code?: string | null;
  error_message?: string | null;
  retryable: boolean;
  retry_count: number;
}
