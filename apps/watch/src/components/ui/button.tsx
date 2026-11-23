import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@watch/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 border border-transparent",
  {
    variants: {
      variant: {
        default: "bg-panel-2 text-paper border-line-2 hover:bg-line",
        outline: "border-line-2 bg-transparent hover:bg-panel-2",
        ghost: "hover:bg-panel-2",
        active: "bg-panel-2 text-paper border-paper",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 px-2 text-xs",
        lg: "h-10 px-4",
        icon: "h-9 w-9",
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
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
