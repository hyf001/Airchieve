import React from "react";

import { useRouter } from "@/app/router";
import { HomePage } from "@/pages/HomePage";
import { SkeletonPage } from "@/pages/prototype/SkeletonPage";

const App: React.FC = () => {
  const { path } = useRouter();

  if (path === "/") {
    return <HomePage />;
  }

  return <SkeletonPage route={path} />;
};

export default App;
