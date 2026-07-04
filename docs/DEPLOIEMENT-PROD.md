# Déploiement production — The Park

> Checklist P0 « prod-ready ». À dérouler dans l'ordre. La sonde `GET /api/health`
> résume l'état des intégrations (`{ ready, checks }`) — vise `ready: true`.

## 0. Sonde de préparation

```bash
curl -s https://<domaine>/api/health | jq
```

`ready` passe à `true` quand `database`, `auth0`, `stripe` et `stripeWebhook` sont OK.
Les autres champs (`resend`, `pusher`, `cronSecret`, `appBaseUrl`) sont indicatifs mais
recommandés.

---

## 1. Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Rôle | Bloquant |
|----------|------|----------|
| `DATABASE_URL` | Postgres Neon (pooler) | ✅ |
| `APP_BASE_URL` | URL canonique prod (ex. `https://thepark.app`) — jamais localhost | ✅ |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET` | Auth0 | ✅ |
| `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET` | Management API (sync rôles) | ✅ admin |
| `STAFF_OWNER_EMAILS` | Bootstrap Owner (emails séparés par virgules) | ✅ admin |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Paiement | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Signature webhook | ✅ |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | E-mails transactionnels | ⚠️ |
| `PUSHER_APP_ID`, `PUSHER_SECRET`, `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER` | Temps réel | ⚠️ |
| `CRON_SECRET` | Auth du cron `/api/cron/maintenance` | ✅ |

> ⚠️ **Régénérer** toute clé exposée en clair (Resend notamment) avant la mise en ligne.

---

## 2. Auth0 — Action Post-Login (sync des rôles)

Sans cette Action, `staffRole` n'est pas propagé dans le token → l'admin retombe sur le
bootstrap par email (`STAFF_OWNER_EMAILS`) uniquement.

**Auth0 Dashboard → Actions → Library → Build Custom → Trigger `Login / Post Login`.**
Coller, puis **Deploy** et glisser l'Action dans le flow `Login`.

```js
/**
 * The Park — Post-Login : expose le rôle staff dans le token.
 * Le back lit le claim `https://thepark.app/staff_role` (voir roles.service.ts).
 */
exports.onExecutePostLogin = async (event, api) => {
  const NS = "https://thepark.app";

  // 1) Rôle staff depuis app_metadata (source de vérité écrite par le back-office)
  const staffRole = event.user.app_metadata && event.user.app_metadata.staff_role;
  if (staffRole) {
    api.idToken.setCustomClaim(`${NS}/staff_role`, staffRole);
    api.accessToken.setCustomClaim(`${NS}/staff_role`, staffRole);
  }

  // 2) Noms de rôles RBAC (utile pour audit / debug côté client)
  if (event.authorization && Array.isArray(event.authorization.roles)) {
    api.idToken.setCustomClaim(`${NS}/roles`, event.authorization.roles);
  }
};
```

**Vérification** : se connecter avec un compte `OWNER`, ouvrir `/admin` → les modules
réservés doivent apparaître. Tester aussi un compte modérateur (accès restreint) et un
membre (redirigé vers `/acces-admin-refuse`).

> Rôles RBAC + app_metadata initiaux : `pnpm auth0:roles` puis `pnpm staff:seed`.

---

## 3. Stripe — webhook bout-en-bout

1. **Dashboard Stripe → Developers → Webhooks → Add endpoint**
   `https://<domaine>/api/webhooks/stripe`.
2. Évènements à écouter :
   - `checkout.session.completed` (boutique, panier marketplace, recharge portefeuille)
   - `account.updated` (Stripe Connect — payouts vendeur)
   - `payment_intent.amount_capturable_updated`, `payment_intent.canceled` (caution C2C)
3. Copier le **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
4. Test local : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
5. L'endpoint est **idempotent** (table `ProcessedWebhookEvent`) : un rejeu renvoie
   `{ duplicate: true }` sans retraiter. Un échec de traitement libère le verrou pour
   autoriser le retry Stripe.

**Recette** : achat boutique test (carte Stripe `4242…`) → commande visible +
`checkout.session.completed` reçu (statut 200) + e-mail Resend.

---

## 4. Resend — domaine + e-mails

1. **Resend → Domains → Add** le domaine d'envoi, publier les DNS (SPF/DKIM).
2. `RESEND_FROM_EMAIL` = adresse vérifiée (ex. `no-reply@thepark.app`).
3. Test : `pnpm test:resend`.

Sans Resend, les notifications restent **in-app** (dégradation propre, pas d'erreur).

---

## 5. Cron de maintenance

`vercel.json` planifie déjà `GET /api/cron/maintenance` (quotidien). Vercel Cron envoie
l'en-tête `Authorization: Bearer $CRON_SECRET` — définir `CRON_SECRET`.

La tâche traite : expiration annonces & enchères, timeouts échanges/ventes C2C, purge des
preuves (60 j), badges de classement, **purge des compteurs de rate-limit** et **purge
LCEN des journaux de connexion (1 an)**.

Scheduler externe (option) : `POST /api/cron/maintenance` avec le même Bearer.

---

## 6. Sécurité applicative (P1 livré)

- **Rate limiting** (Postgres, multi-instances) sur les endpoints sensibles :
  recherche membres, envoi de messages, inscription newsletter. Fail-open sur incident base.
- **ConnectionLog (LCEN)** : une entrée par session navigateur (12 h), IP + user-agent,
  purge automatique à 1 an.

---

## 7. Checklist finale

- [ ] `GET /api/health` → `ready: true`
- [ ] Login OWNER → `/admin` complet ; membre → accès refusé
- [ ] Achat boutique test → commande + e-mail
- [ ] `stripe listen` : évènement traité une fois, rejeu = `duplicate`
- [ ] Cron exécuté (logs : annonces/enchères/purges)
- [ ] Clés exposées régénérées
