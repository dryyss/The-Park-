"use client";

import { useRef, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { contactSellerAction } from "@/server/messaging/messaging.actions";
import { LoginGatePrompt } from "@/components/auth/login-gate-prompt";

export function ContactSellerButton({
  sellerSlug,
  locale,
  children,
  className,
}: {
  sellerSlug: string;
  locale: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { user } = useUser();
  const formRef = useRef<HTMLFormElement>(null);
  const [showLoginGate, setShowLoginGate] = useState(false);

  function handleClick() {
    if (!user) {
      setShowLoginGate(true);
      return;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      {showLoginGate && <LoginGatePrompt compact messageKey="loginGateContact" />}
      <form ref={formRef} action={contactSellerAction}>
        <input type="hidden" name="sellerSlug" value={sellerSlug} />
        <input type="hidden" name="locale" value={locale} />
        <button type="button" onClick={handleClick} className={className}>
          {children}
        </button>
      </form>
    </div>
  );
}
