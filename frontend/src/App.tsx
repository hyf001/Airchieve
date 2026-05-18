import React from "react";

import { useRouter } from "@/app/router";
import { HomePage } from "@/pages/HomePage";
import { BookDetailPage } from "@/pages/BookDetailPage";
import { PlayerPage } from "@/pages/PlayerPage";
import { StoriesPage } from "@/pages/StoriesPage";
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

  if (path === "/stories") {
    return <StoriesPage />;
  }

  if (path === "/book-detail") {
    return <BookDetailPage />;
  }

  if (path === "/player") {
    return <PlayerPage />;
  }

  if (path === "/profile") {
    return <ProfilesPage />;
  }

  return <SkeletonPage route={path} />;
};

export default App;
