import React from "react";

import { useRouter } from "@/app/router";
import { HomePage } from "@/pages/HomePage";
import { BookDetailPage } from "@/pages/BookDetailPage";
import { CreatePage } from "@/pages/CreatePage";
import { PlayerPage } from "@/pages/PlayerPage";
import { MembershipPage } from "@/pages/MembershipPage";
import { PublicSharePage } from "@/pages/PublicSharePage";
import { SharePage } from "@/pages/SharePage";
import { StoriesPage } from "@/pages/StoriesPage";
import { AuthPage } from "@/pages/auth/AuthPage";
import { ProfilesPage } from "@/pages/profiles/ProfilesPage";
import { ArtStylesPage } from "@/pages/assets/ArtStylesPage";
import { CharactersPage } from "@/pages/assets/CharactersPage";
import { VoicesPage } from "@/pages/assets/VoicesPage";
import { AdminPage } from "@/pages/admin/AdminPage";
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

  if (path === "/create") {
    return <CreatePage />;
  }

  if (path === "/artstyle") {
    return <ArtStylesPage />;
  }

  if (path === "/characters") {
    return <CharactersPage />;
  }

  if (path === "/voices") {
    return <VoicesPage />;
  }

  if (path === "/membership") {
    return <MembershipPage />;
  }

  if (path === "/share") {
    return <SharePage />;
  }

  if (path === "/share/public") {
    return <PublicSharePage />;
  }

  if (path === "/admin") {
    return <AdminPage />;
  }

  return <SkeletonPage route={path} />;
};

export default App;
