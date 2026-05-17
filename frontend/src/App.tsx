import React from "react";

import { useRouter } from "@/app/router";
import { HomePage } from "@/pages/HomePage";
import { AuthPage } from "@/pages/auth/AuthPage";
import { ProfilesPage } from "@/pages/profiles/ProfilesPage";
import { SkeletonPage } from "@/pages/prototype/SkeletonPage";

const App: React.FC = () => {
  const { path } = useRouter();

  if (path === "/") {
    return <HomePage />;
  }

  if (path === "/auth") {
    return <AuthPage />;
  }

  if (path === "/profile") {
    return <ProfilesPage />;
  }

  return <SkeletonPage route={path} />;
};

export default App;
