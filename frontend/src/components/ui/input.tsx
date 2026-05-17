import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-[46px] w-full rounded-[var(--radius-sm)] border-2 border-[rgba(212,114,92,0.14)] bg-white px-3.5 text-sm text-[var(--text-dark)] outline-none transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--text-light)] focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
