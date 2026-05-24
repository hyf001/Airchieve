import React from "react";
import { Palette } from "lucide-react";

import { SelectableTile, StepPanel } from "../components";

export const StyleStep: React.FC = () => (
  <StepPanel icon={<Palette className="h-5 w-5" />} title="确定画风" desc="基于故事生成可以选择系统画风或自定义画风；模板路径不会进入这一步。">
    <div className="grid grid-cols-3 gap-3 max-md:grid-cols-2 max-sm:grid-cols-1">
      {["水彩画风", "蜡笔画风", "卡通画风", "睡前温柔", "国风", "手绘线稿"].map((name) => (
        <SelectableTile key={name} selected={name === "水彩画风"} title={name} desc={name === "水彩画风" ? "柔和、温暖，适合 6-12 页绘本" : "可由运营配置权益状态"} />
      ))}
    </div>
  </StepPanel>
);
