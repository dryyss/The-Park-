#!/usr/bin/env tsx
/**
 * Désactive la connexion Google sur l'application Auth0 The Park.
 * Usage : pnpm auth0:disable-google
 */
import "dotenv/config";
import { auth0Management, isAuth0ManagementConfigured } from "../src/lib/auth0-management";

const SOCIAL_STRATEGIES = new Set(["google-oauth2", "facebook", "apple", "github", "twitter", "linkedin"]);

async function main() {
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!clientId) {
    console.error("AUTH0_CLIENT_ID manquant.");
    process.exit(1);
  }
  if (!isAuth0ManagementConfigured()) {
    console.error("Management API non configurée (AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET).");
    process.exit(1);
  }

  const { connections } = await auth0Management.listClientConnections(clientId);
  const social = connections.filter((c) => SOCIAL_STRATEGIES.has(c.strategy));

  if (social.length === 0) {
    console.log("✓ Aucune connexion sociale active sur cette application.");
    return;
  }

  for (const conn of social) {
    try {
      await auth0Management.disableClientConnection(conn.id, clientId);
      console.log(`✓ Désactivé : ${conn.name} (${conn.strategy})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠ API : impossible de désactiver ${conn.name} — ${msg}`);
      console.warn("  → Auth0 Dashboard → Applications → The Park → Connections → désactiver Google");
    }
  }

  console.log("\nLe code force déjà connection=Username-Password-Authentication sur /auth/login.");
  console.log("Redéploie Vercel après push pour appliquer en production.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
