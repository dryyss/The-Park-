"use client";

import { usePathname } from "@/i18n/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Footer } from "@/components/layout/footer";
import { MobileTabs } from "@/components/layout/mobile-tabs";

/** Chrome membre (nav, footer) — masqué dans la console staff (/admin). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStaffConsole = pathname.startsWith("/admin");
  const isImmersive = pathname.startsWith("/onboarding") || pathname.startsWith("/securite/option-envoi");

  if (isStaffConsole || isImmersive) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <div className="flex-1 pb-20 md:pb-0">{children}</div>
        <Footer />
      </div>
      <MobileTabs />
    </>
  );
}
