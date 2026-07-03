# Plan de corrections — Audit The Park (2026-07-02)

Synthèse des audits (sécurité, données, qualité, i18n, config) + audit fonctionnel avec
tests d'intégration exécutés contre une base Postgres réelle. Chaque item confirmé par test
porte la mention **(prouvé)**.

Légende : ☐ à faire · sévérité 🔴 critique / 🟠 élevé / 🟡 moyen / 🟢 mineur

---

## Déjà fait pendant l'audit
- ✅ Réparé les 2 tests unitaires cassés (`test/unit/exchange/propose.test.ts` : mock `prisma.user`).
- ✅ Ajouté un harnais de tests d'intégration (`test/integration/`, `vitest.integration.config.ts`)
  contre une base jetable locale (Docker), Stripe/Resend/Pusher neutralisés — **186 tests**, dont
  4 documentant des bugs (`.fails`).

---

## LOT 1 — 🔴 Bloquants argent / livraison / accès (avant toute prod réelle)

- ☐ **B1 — Vente marketplace : livraison sans issue (prouvé).**
  `markShipmentShipped` (`src/server/c2c/shipment.service.ts:116`) et `markShipmentDelivered`
  (`src/server/c2c/exchange-lifecycle.service.ts:22`) ne transitionnent que si `shipment.exchangeId`
  est présent. Pour une vente (`saleId`), la `Sale` reste bloquée en `AWAITING_SHIPMENT` : `confirmSaleReceipt`
  et `openSaleDispute` deviennent inatteignables, le timeout garantie ne se déclenche jamais → **vendeur
  jamais payé, escrow jamais libéré, carte jamais transférée**.
  → Gérer le cas `saleId` dans les deux fonctions (SALE→SHIPPED, SALE→DELIVERED_WINDOW + `guaranteeEndsAt`),
  avec `TransactionEvent`.

- ☐ **B2 — Enchère gagnée sans suite (prouvé).**
  `settleDueAuctions` (`src/server/auction/auction.mutations.ts:124`) marque `SOLD` + `winnerId` mais ne crée
  ni `Payment`, ni `Sale`, ne transfère pas la carte, et **libère la réservation du vendeur**.
  → À la clôture gagnante : ne pas libérer la réservation, créer une `Sale`/`Payment` (préautorisation,
  deadline paiement 48 h) et brancher le pipeline vente existant (envoi J+3, garantie 72 h, escrow).
  Collecter l'adresse de livraison. Idéalement exiger un moyen de paiement / solde avant d'enchérir.

- ☐ **B3 — Faille d'accès `completeExchange` (prouvé, critique sécurité).**
  `completeExchange(exchangeId)` (`src/server/exchange/exchange.mutations.ts:263`) ne reçoit pas d'acteur ;
  `completeExchangeAction` (`exchange.actions.ts:65`) ne transmet pas `viewer.id`. Un tiers non-participant
  peut finaliser l'échange d'autrui et transférer les cartes (event `actorId=null`, non traçable).
  → Propager `viewer.id` et filtrer `OR:[{initiatorId},{recipientId}]` (comme `cancelExchange`).

- ☐ **B4 — Timeout garantie échange : clôture sans transfert (prouvé, nouveau).**
  `processExchangeTimeouts` (`src/server/c2c/exchange-lifecycle.service.ts:148`) passe l'échange `COMPLETED`
  mais ne transfère pas les `collectionItem` ni ne libère les réservations (contrairement à la confirmation
  manuelle) → collections incohérentes.
  → Réutiliser la même boucle de transfert que `confirmExchangeReceipt`.

- ☐ **B5 — Double dépense wallet (prouvé, C2/C5).**
  `debitWalletForSale` (`src/server/wallet/wallet.service.ts:133`) : lecture-puis-écriture sans verrou →
  deux débits concurrents = double achat pour un seul débit reflété (perte plateforme). `withdrawEarnedToBank`
  (`wallet-withdraw.service.ts:30`) vire l'argent **avant** de débiter.
  → Débit conditionnel atomique (`updateMany({ where:{ id, depositBalance:{ gte } } })` + vérif `count`),
  contrainte SQL `CHECK (depositBalance>=0 AND earnedBalance>=0)`, `@@unique([saleId, type])` sur le ledger,
  et pour le retrait : débiter d'abord, virer ensuite, compenser si échec.

- ☐ **B6 — Double vente d'un même listing (C1, latent).**
  `createSaleFromListing` (`src/server/sale/sale.mutations.ts:39`) : anti double-vente en check-then-act non
  atomique ; `Sale.listingId` non unique.
  → Index unique partiel sur les statuts actifs, ou transition atomique `Listing ACTIVE→SOLD` avec vérif `count`.

- ☐ **B7 — Boutique : double fulfillment + survente (prouvé, C3).**
  `fulfillOrderFromStripeSession` (`src/server/checkout/checkout.service.ts:157-186`) : garde d'idempotence
  hors transaction → double décrément de stock sous appels concurrents (webhook + page succès) ; aucun
  contrôle de stock au paiement → stock négatif.
  → Transition atomique `Order PENDING→PAID` (poursuivre si `count===1`), décrément conditionnel `stock>=qty`.

- ☐ **B8 — Double virement Stripe au vendeur (C4).**
  `releaseToSeller` (`src/server/sale/sale-payment.service.ts:39`) : garde hors transaction, `transfers.create`
  avant mise à jour du statut ; appelé par cron + confirmation → double paiement réel possible.
  → Transition atomique `CAPTURED→RELEASING` + `idempotencyKey` Stripe sur le transfer.

## LOT 2 — 🟠 Intégrité & robustesse

- ☐ **H1 — Libération de réservation trop large (E3).** `expireDueListings`
  (`src/server/marketplace/marketplace.mutations.ts:117`) et `settleDueAuctions`
  (`auction.mutations.ts:134`) décrémentent `reservedQuantity` sur toutes les lignes user+variant sans
  filtrer la `condition` ni garde `>0`. → Cibler `{userId,variantId,condition}` + garde + `CHECK`.
- ☐ **H2 — Décréments sans garde → quantités négatives (E4).** `reallocateCollection`
  (`sale-lifecycle.service.ts:109`) et `confirmExchangeReceipt` : `decrement:1` sans `where quantity>=1`.
- ☐ **H3 — Checkout wallet annule tous les PENDING (prouvé, E2).**
  `startAndFulfillMarketplaceCheckoutWithWallet` (`marketplace-cart-checkout.service.ts:330`) annule tous les
  checkouts `PENDING` de l'acheteur → tue un paiement Stripe en cours ailleurs. → Cibler le checkout concerné.
- ☐ **H4 — `StockMovement` jamais créé sur vente boutique (prouvé).** `checkout.service.ts:181` → journal de
  stock incohérent. Alimenter un `StockMovement` type `SALE` dans la transaction.
- ☐ **H5 — Adresse de livraison absente de l'achat direct.** Seul le panier collecte une adresse ;
  `Sale`/`Shipment` n'ont pas de champ adresse. → Collecter au paiement, rattacher à la vente.
- ☐ **H6 — Pas de `error.tsx` / `not-found.tsx`** sur 71 pages → écran brut Next, 404 non traduit.
- ☐ **H7 — `catch {}` vides avalant les erreurs Stripe** (`sale-payment.service.ts:27,96`) → états DB non
  confirmés côté PSP en prod. Logger + réconcilier.
- ☐ **H8 — Sortir `prisma migrate deploy` du script `build`** (tout build preview migre la base pointée ;
  cause de l'incident P3018). Étape de release dédiée / conditionner à `VERCEL_ENV=production`.
- ☐ **H9 — Photos de messagerie privée dans `public/uploads`** (`src/lib/message-photo-storage.ts`) :
  accessibles sans auth + non persistantes sur Vercel. → Route authentifiée / Blob signé.
- ☐ **H10 — Collection : quantité négative acceptée (prouvé).** `addCollectionItem`
  (`src/server/collection/collection.mutations.ts:6`) ne valide pas `quantity` : un appel service avec une
  valeur négative crée/corrompt une ligne (seule la server action zod protège). → Valider `quantity>=1` dans
  le service + `CHECK` en base.

## LOT 3 — 🟡 Performance, cohérence, conformité

- ☐ **M1 — Cache** : remplacer `force-dynamic` généralisé par ISR (`revalidate`) + `revalidateTag` sur les
  pages publiques (home, saisons, fiches carte, boutique).
- ☐ **M2 — Index manquants** : `Sale.listingId`, `Payment.saleId`, `WalletLedgerEntry.saleId`,
  `Listing.expiresAt`, `Bid.bidderId`, `Shipment(status,notShipDeadline)`…
- ☐ **M3 — Pagination** : `fetchMarketplaceListings`, `getConversationThread`, compteur de non-lus.
- ☐ **M4 — Pool Neon** : utiliser l'endpoint `-pooler` en prod, `max` bas ; mémoïser l'adapter en dev.
- ☐ **M5 — `formatPrice`/dates figés `fr-FR`** (`src/lib/format.ts:6`, ~15 composants) → locale-aware
  (déléguer la copie i18n au subagent i18n-copywriter).
- ☐ **M6 — Rate limiting** (messagerie, enchères, `verifyParentalConsent`).
- ☐ **M7 — Cron quotidien 6 h** (`vercel.json`) → augmenter la fréquence (retards remboursement/clôture).
- ☐ **M8 — Erreurs métier par `Error.message`** → codes typés partagés (`DomainError`/`ActionResult`).
- ☐ **M9 — Génération de numéros par tirage (M4 données)** : retry sur P2002 ou séquence.
- ☐ **M10 — Métadonnée racine FR pour les 3 locales** (`src/app/[locale]/layout.tsx`) → locale-aware.
- ☐ **M11 — Migrations** : doublon d'horodatage, migrations de données mêlées au DDL, dérive out-of-band.
- ☐ **M12 — CI bloquante** : typecheck + lint + `test` + tests d'intégration ; corriger les gardes découvertes.
- ☐ **M13 — Taux de complétion surévalué (prouvé).** `getUserCompletion`
  (`src/server/collection/collection.service.ts:313`) compte les lignes `CollectionItem` (une par
  variante×état, sans filtre `quantity>0`) rapportées au nombre de variantes → peut dépasser 100 %.
  → Compter les variantes distinctes possédées (`quantity>0`).

## LOT 4 — 🟢 Hygiène & dette

- ☐ **L1 — Purger ~50 Mo de binaires trackés** (`bash.exe.stackdump`, PNG racine, vidéos `_reference/`,
  doublons `public/uploads`) ; `*.stackdump` dans `.gitignore`.
- ☐ **L2 — Vulnérabilités npm** (postcss, @hono/node-server) via `pnpm.overrides`.
- ☐ **L3 — Retards majeurs** : stripe 18→22 (sprint dédié), aligner `@types/node` sur Node Vercel.
- ☐ **L4 — 18 warnings ESLint** (code mort `no-unused-vars`, 3 `<img>` → `next/image`).
- ☐ **L5 — i18n en dur** : `auction-create-button.tsx` (100 % FR), restes de `variant-condition-manager.tsx`,
  aria-labels FR, `spotlight-section.tsx`.
- ☐ **L6 — Icônes PWA réelles** (192/512), `theme-color`, `apple-touch-icon`.
- ☐ **L7 — Validation MIME uploads** sur magic bytes (pas `file.type` client) ; refuser si `sharp` échoue.
- ☐ **L8 — Purge/rétention** `ConnectionLog` (LCEN 12 mois), `Notification`, `TransactionEvent`.
- ☐ **L9 — `Review` unicité avec NULL** ; `MarketplaceCartCooldown` sans FK.
- ☐ **L10 — Erreur Prisma brute au lieu d'un code métier.** `updateCollectionQuantity`
  (`src/server/collection/collection.mutations.ts:39`) sur une variante inexistante remonte une P2003 (FK)
  au lieu de `VARIANT_NOT_FOUND` (incohérent avec `addCollectionItem`).
- ☐ **L11 — `adjustCollectionCardQuantity` sans filtre de saison** (`collection.mutations.ts:73`) :
  `card.findFirst({ where:{ number } })` peut cibler la mauvaise carte si deux saisons partagent un numéro
  (ex. hors-série). → Filtrer par saison/contexte.

---

## Environnement de test
Base jetable : `docker run -d --name thepark-qa-pg -e POSTGRES_PASSWORD=qa -e POSTGRES_DB=thepark_qa -p 55432:5432 postgres:17-alpine`
puis `DATABASE_URL="postgresql://postgres:qa@localhost:55432/thepark_qa" pnpm prisma db push`.
Lancer : `pnpm vitest run -c vitest.integration.config.ts`. Le setup refuse toute URL non-localhost.
