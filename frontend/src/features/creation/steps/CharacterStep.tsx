import React from "react";
import { UserRound } from "lucide-react";

import { SelectableTile, StepPanel } from "../components";
import type { WizardPath } from "../constants";

export const CharacterStep: React.FC<{ path: WizardPath }> = ({ path }) => (
  <StepPanel
    icon={<UserRound className="h-5 w-5" />}
    title={path === "template" ? "替换模板角色" : "选择故事形象"}
    desc={path === "template" ? "为必填角色选择头像或保留默认，普通画风和分镜编辑保持关闭。" : "选择故事原形象、系统形象或个人形象来参与生成。"}
  >
    <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
      {["故事主角", "小星星", "系统伙伴"].map((name) => (
        <SelectableTile key={name} selected={name === "小星星"} title={name} desc={name === "小星星" ? "儿童档案默认形象" : "可用于本次创作"} />
      ))}
    </div>
  </StepPanel>
);
