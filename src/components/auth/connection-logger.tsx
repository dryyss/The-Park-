"use client";

import { useEffect } from "react";
import { logConnectionAction } from "@/server/platform/connection-log.actions";

/**
 * Déclenche l'enregistrement du journal de connexion (LCEN) une fois par
 * montage. L'action serveur dédup via cookie de session : aucune écriture si la
 * connexion a déjà été journalisée ou si le visiteur n'est pas authentifié.
 */
export function ConnectionLogger() {
  useEffect(() => {
    logConnectionAction().catch(() => {});
  }, []);
  return null;
}
