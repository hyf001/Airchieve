import React, { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/shared/ui/toast";
import { exportApi } from "./api";
import type { ExportJob, ExportQuality } from "./types";

interface ExportButtonProps {
  bookId: number;
  quality?: ExportQuality;
  label?: string;
  getPrivacyConfirmationId?: (action: "export") => Promise<number | null>;
  onCreated?: (job: ExportJob) => void;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ bookId, quality = "standard", label = "导出 PDF", getPrivacyConfirmationId, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const createKeyRef = React.useRef<string | null>(null);
  const { showToast } = useToast();

  const handleExport = async () => {
    if (createKeyRef.current) return;
    createKeyRef.current = crypto.randomUUID?.() ?? `export-${bookId}-${quality}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLoading(true);
    try {
      const privacyConfirmationId = await getPrivacyConfirmationId?.("export");
      const job = await exportApi.create(bookId, quality, privacyConfirmationId, createKeyRef.current);
      onCreated?.(job);
      showToast(job.status === "succeeded" ? "PDF 已生成" : "导出任务已创建", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导出失败", "error");
    } finally {
      createKeyRef.current = null;
      setLoading(false);
    }
  };

  return (
    <Button className="w-full" disabled={loading} onClick={handleExport}>
      <Download className="h-4 w-4" />
      {loading ? "导出中..." : label}
    </Button>
  );
};
