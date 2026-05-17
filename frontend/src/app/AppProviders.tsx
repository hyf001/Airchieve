import React from "react";

import { RouterProvider } from "@/app/router";
import { AuthProvider } from "@/features/auth";
import { ProfileProvider } from "@/features/profile-management";
import { ToastProvider } from "@/shared/ui/toast";

export const AppProviders: React.FC<React.PropsWithChildren> = ({ children }) => (
  <RouterProvider>
    <ToastProvider>
      <AuthProvider>
        <ProfileProvider>{children}</ProfileProvider>
      </AuthProvider>
    </ToastProvider>
  </RouterProvider>
);
