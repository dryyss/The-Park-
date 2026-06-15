import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "carmin" | "or" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-display font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carmin disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Carmin = action principale (.cursorrules)
  carmin: "bg-carmin text-blanc-casse hover:bg-carmin-alt",
  // Or = officiel boutique / Gold — usage réservé
  or: "bg-or text-charbon hover:brightness-110",
  ghost: "bg-transparent text-blanc-casse hover:bg-charbon-700",
  outline: "border border-charbon-500 text-blanc-casse hover:bg-charbon-700",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ className, variant = "carmin", size = "md", ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
