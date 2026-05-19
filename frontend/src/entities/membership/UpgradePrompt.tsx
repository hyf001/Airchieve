import React from "react";

import { Button } from "@/components/ui/button";
import { AppLink } from "@/shared/ui/AppLink";

export const UpgradePrompt: React.FC<{ message?: string }> = ({ message = "升级会员后可继续使用这项能力。" }) => (
  <div className="app-card flex flex-wrap items-center justify-between gap-3 p-4">
    <p className="text-sm text-[var(--text-mid)]">{message}</p>
    <Button asChild size="sm">
      <AppLink to="/membership">查看会员</AppLink>
    </Button>
  </div>
);
