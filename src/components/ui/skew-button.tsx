"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type SkewButtonVariant = "primary" | "ghost" | "outline";

export function SkewButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: SkewButtonVariant;
}) {
  const base =
    "font-display inline-flex items-center justify-center gap-2 -skew-x-3 rounded-[9px] px-4 py-2.5 text-[12px] tracking-[1.5px] uppercase transition disabled:opacity-50";
  const variants: Record<SkewButtonVariant, string> = {
    primary:
      "bg-carmin text-white shadow-[3px_3px_0_rgba(0,0,0,0.45)] hover:bg-carmin-alt hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_rgba(0,0,0,0.45)]",
    ghost: "bg-transparent text-texte-doux hover:text-blanc-casse",
    outline:
      "border-[1.5px] border-charbon-400 bg-transparent text-texte-doux hover:border-carmin hover:text-blanc-casse",
  };

  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      <span className="inline-block skew-x-3">{children}</span>
    </button>
  );
}

export function SkewLinkButton({
  children,
  variant = "primary",
  className = "",
  href,
}: {
  children: ReactNode;
  variant?: SkewButtonVariant;
  className?: string;
  href: string;
}) {
  const base =
    "font-display inline-flex items-center justify-center gap-2 -skew-x-3 rounded-[9px] px-4 py-2.5 text-[12px] tracking-[1.5px] uppercase no-underline transition";
  const variants: Record<SkewButtonVariant, string> = {
    primary:
      "bg-carmin text-white shadow-[3px_3px_0_rgba(0,0,0,0.45)] hover:bg-carmin-alt hover:-translate-x-0.5 hover:-translate-y-0.5",
    ghost: "bg-transparent text-texte-doux hover:text-blanc-casse",
    outline:
      "border-[1.5px] border-charbon-400 bg-transparent text-texte-doux hover:border-carmin hover:text-blanc-casse",
  };

  return (
    <a href={href} className={`${base} ${variants[variant]} ${className}`}>
      <span className="inline-block skew-x-3">{children}</span>
    </a>
  );
}
