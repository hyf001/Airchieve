import React from "react";
import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/shared/ui/modal";
import { useToast } from "@/shared/ui/toast";
import { moderationApi } from "./api";
import type { ReportReasonType } from "./types";

interface ReportContentDialogProps {
  targetType: string;
  targetId: number;
}

const reasons: Array<{ value: ReportReasonType; label: string }> = [
  { value: "age_inappropriate", label: "不适龄" },
  { value: "copyright", label: "版权问题" },
  { value: "privacy", label: "隐私风险" },
  { value: "abnormal", label: "内容异常" },
  { value: "other", label: "其他" },
];

export const ReportContentDialog: React.FC<ReportContentDialogProps> = ({ targetType, targetId }) => {
  const [open, setOpen] = React.useState(false);
  const [reasonType, setReasonType] = React.useState<ReportReasonType>("age_inappropriate");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { showToast } = useToast();

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await moderationApi.createReport({
        target_type: targetType,
        target_id: targetId,
        reason_type: reasonType,
        description: description.trim() || null,
      });
      setOpen(false);
      setDescription("");
      showToast("举报已提交，管理员会在后台处理", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "举报提交失败", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Flag className="h-4 w-4" />
        举报
      </Button>
      <Modal
        open={open}
        title="举报内容"
        description="举报会进入后台审核队列，并记录处理结果。"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>{submitting ? "提交中" : "提交举报"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {reasons.map((reason) => (
              <button
                key={reason.value}
                type="button"
                className={`rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-semibold transition ${
                  reasonType === reason.value
                    ? "border-[var(--terracotta)] bg-[rgba(212,114,92,0.12)] text-[var(--terracotta)]"
                    : "border-[rgba(212,114,92,0.12)] text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.06)]"
                }`}
                onClick={() => setReasonType(reason.value)}
              >
                {reason.label}
              </button>
            ))}
          </div>
          <textarea
            className="min-h-28 w-full rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.16)] p-3 text-sm outline-none focus:border-[var(--terracotta)]"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="补充说明，可选"
          />
        </div>
      </Modal>
    </>
  );
};
