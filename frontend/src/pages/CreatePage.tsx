import React from "react";

import { CreationWizard } from "@/features/creation";
import { AppShell } from "@/shared/layout/AppShell";

export const CreatePage: React.FC = () => (
  <AppShell>
    <CreationWizard />
  </AppShell>
);
