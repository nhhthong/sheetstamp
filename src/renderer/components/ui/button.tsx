import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent shadow-card hover:opacity-90",
        secondary: "border border-line bg-raised text-text shadow-card hover:bg-panel",
        ghost: "bg-transparent text-accent hover:bg-panel",
        danger: "bg-danger text-on-accent hover:opacity-90",
      },
      size: { md: "px-5 py-2.5", lg: "px-6 py-3 text-lg", sm: "px-3 py-1.5 text-sm" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(button({ variant, size }), className)} {...props} />;
}
