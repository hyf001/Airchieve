import React from "react";
import { BarChart3, ClipboardCheck, FileClock, LayoutDashboard, Mic2, Palette, Sparkles, Tags } from "lucide-react";

import { AuditLogTable } from "@/entities/audit";
import { AdminArtStyleManager, AdminCharacterManager, AdminDashboard, AdminTaxonomyManager, AdminVoiceManager } from "@/features/admin";
import { AnalyticsDashboard } from "@/features/analytics";
import { ModerationQueue } from "@/features/moderation";
import { AppShell } from "@/shared/layout/AppShell";

type AdminTab = "dashboard" | "art-styles" | "characters" | "voices" | "taxonomy" | "moderation" | "analytics" | "audit";

const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "dashboard", label: "概览", icon: LayoutDashboard },
  { id: "art-styles", label: "画风", icon: Palette },
  { id: "characters", label: "角色", icon: Sparkles },
  { id: "voices", label: "声音", icon: Mic2 },
  { id: "taxonomy", label: "分类", icon: Tags },
  { id: "moderation", label: "审核", icon: ClipboardCheck },
  { id: "analytics", label: "统计", icon: BarChart3 },
  { id: "audit", label: "审计", icon: FileClock },
];

export const AdminPage: React.FC = () => {
  const [tab, setTab] = React.useState<AdminTab>("dashboard");

  return (
    <AppShell hideSearch>
      <main className="mx-auto max-w-[1320px] px-8 py-8 max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">运营后台</h1>
            <p className="mt-2 text-sm text-[var(--text-light)]">后台入口聚合审核、统计和审计，具体写操作仍回到目标业务模块。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-bold transition ${
                    tab === item.id
                      ? "bg-[var(--terracotta)] text-white"
                      : "bg-white text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.08)]"
                  }`}
                  onClick={() => setTab(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <section className="mt-6">
          {tab === "dashboard" ? <AdminDashboard /> : null}
          {tab === "art-styles" ? <AdminArtStyleManager /> : null}
          {tab === "characters" ? <AdminCharacterManager /> : null}
          {tab === "voices" ? <AdminVoiceManager /> : null}
          {tab === "taxonomy" ? <AdminTaxonomyManager /> : null}
          {tab === "moderation" ? <ModerationQueue /> : null}
          {tab === "analytics" ? <AnalyticsDashboard /> : null}
          {tab === "audit" ? <AuditLogTable /> : null}
        </section>
      </main>
    </AppShell>
  );
};
