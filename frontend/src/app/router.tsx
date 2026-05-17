import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppRoute =
  | "/"
  | "/stories"
  | "/artstyle"
  | "/characters"
  | "/membership"
  | "/auth"
  | "/profile"
  | "/create"
  | "/player"
  | "/book-detail"
  | "/share"
  | "/voices";

interface RouterContextValue {
  path: AppRoute;
  navigate: (path: AppRoute) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

const routes = new Set<AppRoute>([
  "/",
  "/stories",
  "/artstyle",
  "/characters",
  "/membership",
  "/auth",
  "/profile",
  "/create",
  "/player",
  "/book-detail",
  "/share",
  "/voices",
]);

const normalizePath = (value: string): AppRoute => {
  const path = value.replace(/\.html$/, "").replace(/^\/index$/, "/");
  return routes.has(path as AppRoute) ? (path as AppRoute) : "/";
};

export const routeToHref = (path: AppRoute) => (path === "/" ? "/" : path);

export const RouterProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [path, setPath] = useState<AppRoute>(() => normalizePath(window.location.pathname));

  const navigate = useCallback((nextPath: AppRoute) => {
    window.history.pushState(null, "", routeToHref(nextPath));
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPath(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const value = useMemo(() => ({ path, navigate }), [navigate, path]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used inside RouterProvider");
  }
  return context;
};
