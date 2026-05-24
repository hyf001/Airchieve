import React from "react";

import { TemplateLockedNotice, TemplateSelector, type TemplateSummary } from "@/entities/template";

export const TemplateSourceStep: React.FC<{
  selectedTemplateId: number | null;
  templates: TemplateSummary[];
  onSelectTemplate: (template: TemplateSummary) => void;
}> = ({ selectedTemplateId, templates, onSelectTemplate }) => (
  <div className="space-y-4">
    <TemplateLockedNotice />
    <TemplateSelector templates={templates} selectedId={selectedTemplateId} onSelect={onSelectTemplate} />
  </div>
);
