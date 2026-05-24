import React from "react";

export const PathButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-[var(--terracotta)] text-white" : "text-[var(--text-mid)]"}`}
    onClick={onClick}
  >
    {icon}
    {label}
  </button>
);

export const StepPanel: React.FC<React.PropsWithChildren<{ icon: React.ReactNode; title: string; desc: string }>> = ({ icon, title, desc, children }) => (
  <div>
    <div className="mb-4 flex items-start gap-3">
      <div className="rounded-[var(--radius-sm)] bg-[rgba(212,114,92,0.1)] p-2 text-[var(--terracotta)]">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-[var(--text-dark)]">{title}</h2>
        <p className="text-sm text-[var(--text-light)]">{desc}</p>
      </div>
    </div>
    {children}
  </div>
);

export const SelectableTile: React.FC<{ selected: boolean; title: string; desc: string; onClick?: () => void }> = ({ selected, title, desc, onClick }) => (
  <button
    type="button"
    className={`rounded-[var(--radius-md)] border bg-white p-4 text-left transition hover:-translate-y-0.5 ${selected ? "border-[var(--terracotta)] shadow-[var(--shadow-hover)]" : "border-[rgba(212,114,92,0.1)] shadow-[var(--shadow-soft)]"}`}
    onClick={onClick}
  >
    <div className="font-bold text-[var(--text-dark)]">{title}</div>
    <div className="mt-1 text-xs text-[var(--text-light)]">{desc}</div>
  </button>
);
