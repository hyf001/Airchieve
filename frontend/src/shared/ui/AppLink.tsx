import React from "react";

import { type AppRoute, routeToHref, useRouter } from "@/app/router";

interface AppLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: AppRoute;
}

export const AppLink = React.forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ to, onClick, ...props }, ref) => {
    const { navigate } = useRouter();

    return (
      <a
        ref={ref}
        href={routeToHref(to)}
        onClick={(event) => {
          onClick?.(event);
          if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          event.preventDefault();
          navigate(to);
        }}
        {...props}
      />
    );
  },
);
AppLink.displayName = "AppLink";
