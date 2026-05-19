import React, { useEffect, useState } from "react";
import { FileDown, Link2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExportButton, ExportHistoryList, exportApi, type ExportJob } from "@/features/export";
import { PrivacyConfirmDialog, privacyApi, type PrivacyAction } from "@/features/privacy";
import { ShareDialog, ShareLinkList, shareApi, type ShareLink } from "@/features/share";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

interface PendingPrivacyConfirmation {
  action: PrivacyAction;
  bookId: number;
  riskFlags: string[];
  resolve: (confirmationId: number) => void;
  reject: (error: Error) => void;
}

const readInitialBookId = () => {
  const queryBookId = Number(new URLSearchParams(window.location.search).get("bookId"));
  const storedBookId = Number(window.sessionStorage.getItem("airchieve.current_book_id"));
  if (Number.isFinite(queryBookId) && queryBookId > 0) return queryBookId;
  if (Number.isFinite(storedBookId) && storedBookId > 0) return storedBookId;
  return null;
};

export const SharePage: React.FC = () => {
  const [bookId, setBookId] = useState<number | null>(readInitialBookId);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [pendingPrivacy, setPendingPrivacy] = useState<PendingPrivacyConfirmation | null>(null);
  const [confirmingPrivacy, setConfirmingPrivacy] = useState(false);
  const { showToast } = useToast();

  const load = () => {
    void shareApi.list().then((value) => setLinks(value.items)).catch(() => setLinks([]));
    void exportApi.list().then((value) => setJobs(value.items)).catch(() => setJobs([]));
  };

  useEffect(load, []);

  const getPrivacyConfirmationId = async (action: PrivacyAction) => {
    if (bookId === null) throw new Error("请先选择绘本");
    const targetBookId = bookId;
    const flags = await privacyApi.getFlags("book", targetBookId, action);
    if (!flags.requires_confirmation) return flags.latest_confirmation_id;
    return new Promise<number>((resolve, reject) => {
      setPendingPrivacy({ action, bookId: targetBookId, riskFlags: flags.risk_flags, resolve, reject });
    });
  };

  const handleCancelPrivacy = () => {
    pendingPrivacy?.reject(new Error("已取消隐私确认"));
    setPendingPrivacy(null);
  };

  const handleConfirmPrivacy = async () => {
    if (!pendingPrivacy) return;
    setConfirmingPrivacy(true);
    try {
      const confirmation = await privacyApi.recordPrivacyConfirmation({
        action: pendingPrivacy.action,
        target: { target_type: "book", target_id: pendingPrivacy.bookId },
        risk_flags: pendingPrivacy.riskFlags,
      });
      pendingPrivacy.resolve(confirmation.id);
      setPendingPrivacy(null);
    } catch (error) {
      pendingPrivacy.reject(error instanceof Error ? error : new Error("隐私确认失败"));
      setPendingPrivacy(null);
    } finally {
      setConfirmingPrivacy(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1320px] px-8 py-8 max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">分享与导出</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">将绘本分享给家人，或导出为 PDF 保存。</p>
          </div>
          <label className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-3 py-2 text-sm shadow-[var(--shadow-soft)]">
            绘本 ID
            <input
              className="w-20 rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.12)] px-2 py-1"
              min={1}
              type="number"
              value={bookId ?? ""}
              onChange={(event) => {
                const next = Number(event.target.value);
                setBookId(Number.isFinite(next) && next > 0 ? next : null);
              }}
            />
          </label>
        </div>

        {bookId === null ? (
          <section className="app-card mt-6 p-5 text-sm text-[var(--text-mid)]">请先从绘本详情页进入分享，或输入要分享/导出的绘本 ID。</section>
        ) : (
        <section className="mt-6 grid grid-cols-[1fr_0.9fr] gap-5 max-lg:grid-cols-1">
          <ShareDialog
            bookId={bookId}
            getPrivacyConfirmationId={getPrivacyConfirmationId}
            onCreated={(link) => setLinks((current) => [link, ...current.filter((item) => item.id !== link.id)])}
          />
          <div className="app-card p-5">
            <div className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-[var(--terracotta)]" />
              <h2 className="font-display text-2xl">PDF 导出</h2>
            </div>
            <p className="mt-2 text-sm text-[var(--text-light)]">导出会扣减本月 PDF 额度；高清导出由会员权益控制。</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <ExportButton
                bookId={bookId}
                quality="standard"
                label="标准 PDF"
                getPrivacyConfirmationId={getPrivacyConfirmationId}
                onCreated={(job) => setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)])}
              />
              <ExportButton
                bookId={bookId}
                quality="high"
                label="高清 PDF"
                getPrivacyConfirmationId={getPrivacyConfirmationId}
                onCreated={(job) => setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)])}
              />
            </div>
          </div>
        </section>
        )}

        <section className="mt-5 app-card flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-[var(--honey)]" />
          <p className="text-sm text-[var(--text-mid)]">含个人形象或个人声音的绘本，分享或导出前需要完成隐私风险确认；前端只提交确认记录，后端负责校验。</p>
        </section>

        <section className="mt-8 grid grid-cols-2 gap-5 max-lg:grid-cols-1">
          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl"><Link2 className="h-5 w-5" />分享记录</h2>
            <ShareLinkList
              links={links}
              onClose={async (link) => {
                const next = await shareApi.close(link.id);
                setLinks((current) => current.map((item) => (item.id === next.id ? next : item)));
                showToast("分享链接已关闭", "success");
              }}
              onRegenerate={async (link) => {
                const next = await shareApi.regenerateToken(link.id);
                setLinks((current) => current.map((item) => (item.id === next.id ? next : item)));
                showToast(next.public_url ? "新链接已生成" : "链接已重置", "success");
              }}
            />
          </div>
          <div>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl"><FileDown className="h-5 w-5" />导出记录</h2>
            <ExportHistoryList jobs={jobs} />
          </div>
        </section>
        <div className="mt-6 pb-10">
          <Button variant="ghost" onClick={load}>刷新记录</Button>
        </div>
        {pendingPrivacy ? (
          <PrivacyConfirmDialog
            actionLabel={pendingPrivacy.action === "share" ? "分享" : "导出"}
            riskFlags={pendingPrivacy.riskFlags}
            loading={confirmingPrivacy}
            onCancel={handleCancelPrivacy}
            onConfirm={() => void handleConfirmPrivacy()}
          />
        ) : null}
      </main>
    </AppShell>
  );
};
