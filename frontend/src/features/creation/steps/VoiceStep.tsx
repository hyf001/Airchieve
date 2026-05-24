import React from "react";
import { Mic2 } from "lucide-react";

import { SelectableTile, StepPanel } from "../components";
import type { WizardPath } from "../constants";

export const VoiceStep: React.FC<{ path: WizardPath }> = ({ path }) => (
  <StepPanel
    icon={<Mic2 className="h-5 w-5" />}
    title="选择朗读声音"
    desc={path === "template" ? "可使用模板默认声音；替换声音时不改变正文、对白和播放节奏。" : "系统声音和个人声音都可作为整本生成声音。"}
  >
    <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
      {["温柔姐姐", "活泼哥哥", path === "template" ? "模板默认声音" : "妈妈的声音"].map((name) => (
        <SelectableTile key={name} selected={name.includes("温柔") || name.includes("模板")} title={name} desc="中文 · 可试听 · 可使用" />
      ))}
    </div>
  </StepPanel>
);
