"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

function format(diffMs: number): string {
  if (diffMs <= 0) return "00:00:00";
  const totalSec = Math.floor(diffMs / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}j ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Compte à rebours live (tick chaque seconde). À 0, rafraîchit la page une fois
 * pour récupérer l'état clôturé de l'enchère.
 */
export function AuctionCountdown({
  endsAt,
  endedLabel,
  className,
}: {
  endsAt: string | number | Date;
  endedLabel: string;
  className?: string;
}) {
  const target = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rafraîchit une fois au passage à zéro pour afficher l'enchère clôturée.
  useEffect(() => {
    if (now != null && now >= target) router.refresh();
  }, [now, target, router]);

  // SSR / premier rendu : valeur figée pour éviter un mismatch d'hydratation.
  const diff = now == null ? target - Date.now() : target - now;
  if (diff <= 0) return <span className={className}>{endedLabel}</span>;
  return (
    <span className={className} suppressHydrationWarning>
      {format(diff)}
    </span>
  );
}
