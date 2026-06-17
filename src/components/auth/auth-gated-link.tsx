"use client";

import { useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { Link } from "@/i18n/navigation";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

export function AuthGatedLink({
  href,
  children,
  className,
  messageKey = "loginGateDefault",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  messageKey?: string;
}) {
  const { user } = useUser();
  const [showLoginGate, setShowLoginGate] = useState(false);

  if (showLoginGate) {
    return (
      <div className="flex flex-col gap-2">
        <LoginGatePrompt compact messageKey={messageKey} />
        <Link href={href} className={className} onClick={() => setShowLoginGate(false)}>
          {children}
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (!user) {
          e.preventDefault();
          setShowLoginGate(true);
        }
      }}
    >
      {children}
    </Link>
  );
}
