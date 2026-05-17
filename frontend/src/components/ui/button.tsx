import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-5 py-2.5 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,var(--peach),var(--terracotta))] text-white shadow-[0_3px_12px_rgba(212,114,92,0.3)] hover:-translate-y-0.5 hover:shadow-[0_5px_20px_rgba(212,114,92,0.4)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border-[1.5px] border-[rgba(212,114,92,0.2)] bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)] hover:bg-[rgba(212,114,92,0.15)]",
        secondary:
          "border-[1.5px] border-[rgba(212,114,92,0.2)] bg-[rgba(212,114,92,0.1)] text-[var(--terracotta)] hover:bg-[rgba(212,114,92,0.15)]",
        sage:
          "bg-[linear-gradient(135deg,var(--sage),var(--sage-deep))] text-white shadow-[0_3px_12px_rgba(94,160,122,0.3)] hover:-translate-y-0.5",
        ghost:
          "bg-transparent text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.06)] hover:text-[var(--terracotta)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2.5",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-[var(--radius-md)] px-8 text-[15px]",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
