import React from "react";

import { RouterProvider } from "@/app/router";
import { ToastProvider } from "@/shared/ui/toast";

export const AppProviders: React.FC<React.PropsWithChildren> = ({ children }) => (
  <RouterProvider>
    <ToastProvider>{children}</ToastProvider>
  </RouterProvider>
);
