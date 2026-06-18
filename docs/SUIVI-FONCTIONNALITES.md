# Suivi fonctionnalités — The Park

> **Document vivant** : actualiser ce fichier à chaque livraison significative (feature, fix, config prod).
>
> **Dernière revue** : 2026-06-16 · **Baseline** : post-vagues A→E + audit projet  
> **Sprint actif** : Sprint 1 — Prod-ready (P0)

---

## Comment utiliser ce tableau

1. **Par écran** : repérer la route, lire chaque ligne « fonctionnalité ».
2. **Statut** : mettre à jour la colonne `Statut` et la date `MAJ`.
3. **Notes** : décrire le gap concret ou la config manquante (ex. `RESEND_*`, Auth0 Action).
4. **Priorité** : P0 = bloquant prod · P1 = qualité/sécurité · P2 = C2C prod · P3 = V2.

### Légende des statuts

| Symbole | Signification |
|---------|---------------|
| ✅ OK | Flux bout-en-bout fonctionnel (UI + backend + DB) |
| ⚠️ Partiel | Implémenté mais incomplet, dégradé ou stub |
| ❌ Manquant | Non implémenté ou volontairement absent (règle métier) |
| 🔧 Config | Code prêt, dépend d'une variable d'env. ou service externe |

---

## Synthèse globale

| Zone | Écrans | ✅ | ⚠️ | ❌ | 🔧 |
|------|--------|----|----|----|-----|
| Public & catalogue | 8 | 14 | 3 | 0 | 0 |
| Membre (collection, profil, paramètres) | 6 | 18 | 1 | 0 | 0 |
| Marketplace & enchères | 5 | 11 | 0 | 1* | 0 |
| Échanges & messagerie | 4 | 10 | 2 | 0 | 1 |
| Boutique officielle | 6 | 9 | 0 | 0 | 1 |
| Sécurité C2C | 7 | 4 | 6 | 2 | 1 |
| Admin | 8 | 8 | 3 | 0 | 1 |
| API & transversal | 5 routes + 6 | 12 | 2 | 3 | 5 |
| **Total fonctionnalités suivies** | **47 pages** | **~86** | **~17** | **~6** | **~9** |

\* Paiement marketplace = **volontairement absent** (règle métier : mise en relation uniquement).

**Maturité estimée** : MVP ~70 % · C2C prod-ready ~40 % · Tests automatisés 0 %

---

## 1. Public & accueil

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/` | Hero + stats catalogue | `catalog.service` | `HeroSection` | ✅ | — | revalidate 60s | 2026-06-16 |
| `/` | Bandeau raretés | `catalog.service` | `RarityCarousel` | ✅ | — | | 2026-06-16 |
| `/` | Cartes mises en avant | `catalog.service` | `FeaturedCards` | ✅ | — | | 2026-06-16 |
| `/` | Bannière saison | — | `SeasonBanner` | ✅ | — | Lien statique /collection | 2026-06-16 |
| `/` | Dernières annonces marketplace | `marketplace.service` | `LatestListings` | ✅ | — | Prix indicatifs | 2026-06-16 |
| `/` | Activité + top collectionneurs | `community.service` | `ActivityFeed`, `TopCollectors` | ✅ | — | | 2026-06-16 |
| `/` | Bandeau erreur auth | — | i18n auth | ✅ | — | Query `auth_error` | 2026-06-16 |
| `/recherche` | Recherche + filtres + tri | `catalog.service` | `FilterChipGroup`, `HoloCard` | ✅ | — | | 2026-06-16 |
| `/carte/[slug]` | Détail carte + versions possédées | `catalog.service` | `OwnedVariantStack` | ✅ | — | | 2026-06-16 |
| `/carte/[slug]` | Gestion possession (qty, état, édition) | `collection.actions` | `CardMemberActions` | ✅ | — | Auth requis | 2026-06-16 |
| `/carte/[slug]` | Wishlist depuis fiche | `wishlist.actions` | `CardMemberActions` | ✅ | — | | 2026-06-16 |
| `/carte/[slug]` | Annonces liées + contact vendeur | `catalog.service` | `ContactSellerButton` | ✅ | — | Pas de paiement | 2026-06-16 |
| `/carte/[slug]` | Navigation prev/next | `catalog.service` | Breadcrumb | ✅ | — | | 2026-06-16 |
| `/collectionneur/[slug]` | Profil public + stats | `community.service` | En-tête profil | ✅ | — | | 2026-06-16 |
| `/collectionneur/[slug]` | Aperçu collection (12 cartes) | `collection.service` | `CollectionCardTile` | ✅ | — | | 2026-06-16 |
| `/collectionneur/[slug]` | Contacter le membre | `messaging.actions` | `ContactSellerButton` | ✅ | — | Conversation contextualisée | 2026-06-16 |
| `/saison-1` | Cartes S01 + possession | `catalog.service` | `SeasonCardTile` | ✅ | — | | 2026-06-16 |
| `/saison-2` | Teaser saison verrouillée | `site.service` | `SeasonLockedTeaser` | ⚠️ | P3 | Volontairement non jouable | 2026-06-16 |
| `/drop` | Teaser drop + date | `site.service` | `DropTeaser` | ⚠️ | P3 | Pas d'achat/réservation | 2026-06-16 |
| `/drop` | Inscription drop dédiée | — | — | ❌ | P3 | CTA → /notifications seulement | 2026-06-16 |
| `/aide` | FAQ par catégorie | `data/help-faq.ts` + i18n | `HelpFaq` | ✅ | — | Contenu statique | 2026-06-16 |
| `/onboarding` | Parcours guidé 4 étapes | — | `OnboardingSteps` | ✅ | — | Liens modules clés | 2026-06-16 |
| `/classements` | Podium + tableau paginé | `community.service` | `RankingsPodium` | ✅ | — | | 2026-06-16 |
| `/classements` | Rang membre connecté | `community.service` | Texte yourRank | ✅ | — | | 2026-06-16 |
| `/trophees` | Grille badges | `trophy.service` | `TrophyGrid` | ✅ | — | Public si invité | 2026-06-16 |

---

## 2. Collection & wishlist

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/collection` | Grille par rareté + progression | `collection.service` | `CompletionPanel` | ✅ | — | Invité = lecture seule | 2026-06-16 |
| `/collection` | Filtres segment/rareté/recherche | `collection.service` | `CollectionFiltersBar` | ✅ | — | | 2026-06-16 |
| `/collection` | Tri + colonnes grille | — | `CollectionDisplayControls` | ✅ | — | Query params | 2026-06-16 |
| `/collection` | Ajustement quantités + état | `collection.actions` | `CollectionQuantityControls` | ✅ | — | Auth requis | 2026-06-16 |
| `/collection` | Onglet Saison 2 | — | Badge seasonSoon | ⚠️ | P3 | Teaser visuel | 2026-06-16 |
| `/wishlist` | Liste cartes souhaitées | `wishlist.service` | `WishlistGridClient` | ✅ | — | | 2026-06-16 |
| `/wishlist` | Retrait wishlist | `wishlist.actions` | `WishlistGridClient` | ✅ | — | | 2026-06-16 |

---

## 3. Marketplace & enchères

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/marketplace` | Onglets Vendre / Recherche (want) | `marketplace.service` | `MarketplaceFilters` | ✅ | — | Disclaimer prix indicatifs | 2026-06-16 |
| `/marketplace` | Filtres rareté/état/version | `marketplace.service` | `ListingCard` | ✅ | — | | 2026-06-16 |
| `/marketplace` | Paiement marketplace | `wallet.service`, `sale.actions` | `BuyListingButton` | ✅ | — | Portefeuille crédits (recharge Stripe + 5 % frais) | 2026-06-18 |
| `/portefeuille` | Recharge crédits (min. 5 €) | `wallet-topup.service` | `WalletTopUpForm` | ✅ | — | 2 soldes : dépôt (achat) + gains (retrait à venir) | 2026-06-18 |
| `/vendre` | Prérequis vendeur (âge, adresse, parental) | `seller-readiness.service` | `SellerReadiness` | ✅ | — | Versement vendeur → portefeuille | 2026-06-18 |
| `/vendre` | Publication annonce fixe | `marketplace.actions` | `SellForm` | ✅ | — | Vérif possession | 2026-06-16 |
| `/vendre` | Création enchère depuis vente | `auction.actions` | `SellForm` | ✅ | — | Redirige /encheres | 2026-06-16 |
| `/dashboard` | Stats vendeur | `dashboard.service` | `DashboardPanel` | ✅ | — | Preview vide si invité | 2026-06-16 |
| `/dashboard` | Gestion annonces (pause/reprise/annulation) | `marketplace.actions` | `ListingActions` | ✅ | — | | 2026-06-16 |
| `/encheres` | Grille enchères actives | `auction.service` | `AuctionGrid` | ✅ | — | Pas de paiement à l'enchère | 2026-06-16 |
| `/encheres` | Compte à rebours + anti-snipe | `auction.service` | `AuctionCountdown` | ✅ | P1 | Cron `settleDueAuctions` | 2026-06-16 |
| `/encheres/[id]` | Détail + historique enchères | `auction.service` | `AuctionDetailPanel` | ✅ | — | | 2026-06-16 |
| `/encheres/[id]` | Placer une enchère | `auction.actions` | `AuctionBidForm` | ✅ | — | Auth requis | 2026-06-16 |

---

## 4. Échanges & messagerie

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/echanges` | Liste en cours / terminés | `exchange.service` | `ExchangeBoard` | ✅ | — | | 2026-06-16 |
| `/echanges` | Accepter / annuler proposition | `exchange.actions` | `ExchangeActionsPanel` | ✅ | — | Double validation | 2026-06-16 |
| `/echanges` | Opportunités d'échange | `exchange.service` | `ExchangeBoard` | ✅ | — | Visible invités (lecture) | 2026-06-16 |
| `/echanges` | Badge envoi sécurisé | `exchange.service` | `ExchangeBoard` | ⚠️ | P2 | Affichage seulement | 2026-06-16 |
| `/echanges/proposer` | Proposition échange (cartes + message) | `exchange.actions` | `ExchangeProposeForm` | ✅ | — | | 2026-06-16 |
| `/echanges/proposer` | Option envoi sécurisé (`secured`) | `exchange.actions` | — | ❌ | P2 | Backend prêt, UI absente | 2026-06-16 |
| `/messages` | Liste conversations contextualisées | `conversation.service` | `ConversationList` | ✅ | — | Pas de MP libre | 2026-06-16 |
| `/messages/[id]` | Thread + envoi message | `messaging.actions` | `MessageComposeForm` | ✅ | — | | 2026-06-16 |
| `/messages/[id]` | Temps réel Pusher | `/api/pusher/auth` | `ConversationMessageList` | 🔧 | P1 | Polling si Pusher absent | 2026-06-16 |
| `/messages/[id]` | Signalement message | `messaging.actions` | `MessageReportButton` | ✅ | — | → modération admin | 2026-06-16 |
| `/messages/[id]` | Marquer conversation lue | `messaging.mutations` | — | ✅ | — | Server-side à l'ouverture | 2026-06-16 |
| `/notifications` | Liste notifications in-app | `notification.service` | `NotificationList` | ✅ | — | | 2026-06-16 |
| `/notifications` | Marquer lu / tout lu | `notification.actions` | `NotificationActions` | ✅ | — | | 2026-06-16 |
| `/notifications` | E-mails transactionnels | `notification.mutations` + Resend | — | 🔧 | P0 | `RESEND_*` requis | 2026-06-16 |

---

## 5. Boutique officielle (Stripe)

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/boutique` | Catalogue produits + filtres | `shop.service` | `ShopHero`, `ProductTile` | ✅ | — | Badge or Officiel | 2026-06-16 |
| `/boutique/[slug]` | Détail produit + stock | `shop.service` | `AddToCartButton` | ✅ | — | | 2026-06-16 |
| `/boutique/[slug]` | Ajout panier | `cart.actions` | `AddToCartButton` | ✅ | — | | 2026-06-16 |
| `/boutique/panier` | Lignes panier + quantités | `cart.service`, `cart.actions` | `CartView` | ✅ | — | Auth obligatoire | 2026-06-16 |
| `/boutique/panier` | Récap + lien checkout | `cart.service` | `CartView` | ✅ | — | Frais port via `PlatformConfig` | 2026-06-16 |
| `/boutique/checkout` | Stripe Checkout Session | `checkout.actions` | `CheckoutForm` | 🔧 | P0 | `STRIPE_*` requis | 2026-06-16 |
| `/boutique/checkout` | Message annulation paiement | — | Query cancelled=1 | ✅ | — | | 2026-06-16 |
| `/boutique/commandes` | Historique commandes | `order.service` | `OrderList` | ✅ | — | | 2026-06-16 |
| `/boutique/commandes/[id]` | Détail commande | `order.service` | `OrderDetailPanel` | ✅ | — | | 2026-06-16 |
| `/boutique/commandes/[id]` | Sync post-paiement (return URL) | `checkout.service` | Bandeau succès | ✅ | — | Fallback si webhook lent | 2026-06-16 |
| `/panier` | Redirect legacy → /boutique/panier | — | redirect | ✅ | — | | 2026-06-16 |

---

## 6. Profil & paramètres

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/profil` | En-tête stats + complétion | `profile.service` | `ProfileHeader` | ✅ | — | | 2026-06-16 |
| `/profil` | Badges + avis | `profile.service` | `ProfileBadges`, `ProfileReviews` | ✅ | — | | 2026-06-16 |
| `/profil` | Invité / récupération compte | `user.service` | `ProfileGuestOrRecovery` | ✅ | — | | 2026-06-16 |
| `/parametres` | Identité (nom, bio, slug) | `profile.actions` | `ProfileIdentityForm` | ✅ | — | | 2026-06-16 |
| `/parametres` | Carnet d'adresses | `address.service`, `settings.actions` | `AddressBook` | ✅ | — | | 2026-06-16 |
| `/parametres` | Préférences notifications | `settings.actions` | `SettingsForm` | ✅ | — | | 2026-06-16 |
| `/parametres` | Sécurité compte (email, reset Auth0) | `account.service` | `AccountSecuritySection` | ✅ | — | | 2026-06-16 |
| `/parametres` | Export données RGPD (JSON) | `account.actions` | `ExportDataButton` | ✅ | — | | 2026-06-16 |
| `/parametres` | Changement langue | — | `SettingsForm` | ✅ | — | fr / ja / en | 2026-06-16 |

---

## 7. Sécurité C2C (échanges postaux)

> Pages communes : `renderSecurityPage` → `security.service` + `SecurityPageLayout` + `SecurityActionsPanel`

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/securite/*` | Auth obligatoire | `user.service` | — | ✅ | — | | 2026-06-16 |
| `/securite/*` | Contexte échange actif | `security.service` | `SecurityContextBanner` | ✅ | — | Null si aucun échange | 2026-06-16 |
| `/securite/garantie` | Marquer livré / confirmer réception | `c2c.actions` | `SecurityActionsPanel` | ✅ | — | | 2026-06-16 |
| `/securite/option-envoi` | Autoriser caution | `caution.service` | Bouton sans Stripe Elements | ⚠️ | P2 | PI créé, pas confirmé client | 2026-06-16 |
| `/securite/envoi` | Expédition + suivi manuel | `c2c.actions` | `SecurityActionsPanel` | ⚠️ | P2 | Pas d'agrégateur transporteur | 2026-06-16 |
| `/securite/envoi` | Preuve présentation (vidéo) | `shipment.service` | URL + hash SHA-256 | ⚠️ | P2 | Spec = capture in-app continue | 2026-06-16 |
| `/securite/deballage` | Preuve déballage | `shipment.service` | URL + hash | ⚠️ | P2 | Idem | 2026-06-16 |
| `/securite/echange` | Création envoi échange | `c2c.actions` | `SecurityActionsPanel` | ✅ | — | | 2026-06-16 |
| `/securite/etats` | Visualisation machine à états | — | i18n + nav steps | ⚠️ | P2 | Pas de viz dynamique DB | 2026-06-16 |
| `/securite/litige` | Ouverture litige | `c2c.actions` | `SecurityActionsPanel` | ✅ | — | | 2026-06-16 |
| `/securite/*` | Machine à états + timeouts J+3 | `exchange-lifecycle.service` | — | ⚠️ | P2 | Cron OK ; J+5/prolongation partiels | 2026-06-16 |
| `/securite/*` | Suivi transporteur agrégateur | — | — | ❌ | P2 | La Poste, Chronopost, MR… | 2026-06-16 |
| `/securite/*` | Choix croisé envoi sécurisé | `exchange.mutations` | — | ❌ | P2 | Flag BDD, UI proposition absente | 2026-06-16 |
| `/securite/*` | Purge preuves RGPD 60 j | `shipment.service` | — | ✅ | P1 | Via cron maintenance | 2026-06-16 |
| `/securite/*` | Webhook Stripe caution | — | — | ❌ | P2 | Seul checkout boutique webhooké | 2026-06-16 |

---

## 8. Admin

| Route | Fonctionnalité | Backend | UI | Statut | P | Notes | MAJ |
|-------|----------------|---------|-----|--------|---|-------|-----|
| `/admin` | KPIs plateforme | `admin.service` | `AdminOverviewPanel` | ✅ | — | Module overview | 2026-06-16 |
| `/admin` | Navigation selon rôle | `permissions.service` | `AdminOverviewPanel` | ✅ | — | Masquage modules | 2026-06-16 |
| `/admin/boutique` | Création produit | `shop.actions` | `AdminProductCreateForm` | ✅ | — | | 2026-06-16 |
| `/admin/boutique` | Édition prix/stock/actif | `shop.actions` | `AdminShopEditor` | ✅ | — | | 2026-06-16 |
| `/admin/commandes` | Liste + changement statut | `admin.mutations` | `AdminOrdersPanel` | ✅ | — | Workflow manuel | 2026-06-16 |
| `/admin/catalogue` | Édition métadonnées saisons | `shop.actions` | `AdminCatalogPanel` | ⚠️ | P2 | Pas CRUD cartes/versions | 2026-06-16 |
| `/admin/moderation` | Signalements en attente | `moderation.actions` | `AdminModerationPanel` | ✅ | — | Priorité mineurs | 2026-06-16 |
| `/admin/moderation` | Litiges ouverts | `moderation.actions` | `AdminModerationPanel` | ✅ | — | | 2026-06-16 |
| `/admin/roles` | Assignation rôles staff | `roles.actions` | `RolesAdminPanel` | ✅ | — | Owner pour actions sensibles | 2026-06-16 |
| `/admin/roles` | Sync rôles Auth0 | `roles.actions` | `RolesAdminPanel` | 🔧 | P0 | Auth0 M2M + Action Post-Login | 2026-06-16 |
| `/admin/reglages` | PlatformConfig (port, transporteur, démo) | `platform.actions` | `AdminPlatformSettings` | ✅ | — | | 2026-06-16 |
| `/admin/support` | Stats support + membres récents | `support.service` | `AdminSupportPanel` | ⚠️ | P3 | Lecture seule, pas de ticketing | 2026-06-16 |

---

## 9. API & jobs

| Route | Fonctionnalité | Backend | Statut | P | Notes | MAJ |
|-------|----------------|---------|--------|---|-------|-----|
| `GET /api/topbar` | Compteurs panier / notifs / messages | `cart`, `notification`, `conversation` services | ✅ | — | Polling client top-bar | 2026-06-16 |
| `POST /api/pusher/auth` | Auth canal Pusher privé | `lib/pusher` | 🔧 | P1 | `PUSHER_*` | 2026-06-16 |
| `POST /api/webhooks/stripe` | checkout.session.completed | `checkout.service`, `wallet-topup` | 🔧 | P0 | `STRIPE_WEBHOOK_SECRET` — boutique + wallet top-up | 2026-06-18 |
| `POST /api/webhooks/stripe` | Webhooks caution C2C / Connect | — | ❌ | P2 | Retrait bancaire Connect vendeur non géré | 2026-06-18 |
| `POST /api/cron/maintenance` | Expiration annonces | `marketplace.mutations` | ✅ | P0 | Bearer `CRON_SECRET` | 2026-06-16 |
| `POST /api/cron/maintenance` | Clôture enchères | `auction.mutations` | ✅ | P0 | Scheduler externe requis | 2026-06-16 |
| `POST /api/cron/maintenance` | Purge preuves C2C | `shipment.service` | ✅ | P1 | | 2026-06-16 |
| `POST /api/cron/maintenance` | Timeouts échanges C2C | `exchange-lifecycle.service` | ✅ | P1 | | 2026-06-16 |

---

## 10. Transversal (hors écrans)

| Domaine | Fonctionnalité | Statut | P | Notes | MAJ |
|---------|----------------|--------|---|-------|-----|
| Auth | Connexion / inscription Auth0 | ✅ | — | Sync rôles corrigée | 2026-06-16 |
| Auth | Action Post-Login sync rôles | 🔧 | P0 | Config manuelle dashboard Auth0 | 2026-06-16 |
| Auth | Protection mineurs (âge, parental) | ✅ | — | seller-readiness + modération | 2026-06-16 |
| i18n | fr / ja / en sur toutes pages | ✅ | — | Quelques clés « bientôt » obsolètes | 2026-06-16 |
| Notifs | In-app + prefs utilisateur | ✅ | — | | 2026-06-16 |
| Notifs | E-mail Resend | 🔧 | P0 | Sandbox OK ; domaine prod à vérifier | 2026-06-16 |
| Notifs | Pusher temps réel | 🔧 | P1 | Fallback polling | 2026-06-16 |
| Badges | Déblocage automatique | ✅ | — | `badge.service` | 2026-06-16 |
| Footer | Newsletter | ❌ | P3 | Form sans handler | 2026-06-16 |
| Tests | Vitest / e2e | ❌ | P1 | 0 test automatisé | 2026-06-16 |
| CMS | Payload cartes/saisons | ❌ | P2 | Seed Prisma uniquement | 2026-06-16 |
| DB orphelins | Sale, TrackingEvent, DisputeResolution… | ⚠️ | P2 | Cycle vente + wallet actifs ; Connect retrait à brancher | 2026-06-18 |
| Config | `.env.example` versionné | ❌ | P0 | À créer | 2026-06-16 |
| LCEN | ConnectionLog | ❌ | P1 | Modèle présent, non branché | 2026-06-16 |
| Rate limiting | Endpoints sensibles | ❌ | P1 | Non implémenté | 2026-06-16 |

---

## Backlog priorisé (prochaines itérations)

### P0 — Bloquant déploiement prod

| # | Item | Écrans impactés | Effort |
|---|------|-----------------|--------|
| 1 | `.env.example` + doc variables | Transversal | S |
| 2 | Auth0 Action Post-Login + test rôles | `/admin/roles`, tout admin | S |
| 3 | Cron planifié (Vercel / autre) | API maintenance | S |
| 4 | Stripe prod (checkout + webhook testé) | `/boutique/checkout` | M |
| 5 | Resend domaine vérifié + e-mails clés | Notifications, commandes | M |
| 6 | Régénérer clé Resend (exposée en chat) | Transversal | S |

### P1 — Qualité & conformité

| # | Item | Effort |
|---|------|--------|
| 7 | Tests Vitest (machine à états, possession, permissions) | L |
| 8 | Rate limiting API sensibles | M |
| 9 | ConnectionLog LCEN | M |
| 10 | Nettoyage i18n obsolète (« bientôt », editSoon) | S |
| 11 | Pusher configuré + test messagerie live | M |

### P2 — C2C production

| # | Item | Effort |
|---|------|--------|
| 12 | UI option `secured` à la proposition échange | M |
| 13 | Stripe Elements + webhook PI caution | L |
| 14 | Preuves vidéo in-app (caméra, jeton du jour) | XL |
| 15 | Machine à états complète (J+5, prolongation, viz /etats) | L |
| 16 | Agrégateur transporteurs | L |
| 17 | DisputeResolution + modération enrichie | M |
| 18 | Admin CRUD cartes (Payload ou admin natif) | XL |

### P3 — V2 produit

| # | Item | Effort |
|---|------|--------|
| 19 | Drop avec réservation / achat | L |
| 20 | Saison 2 jouable | L |
| 21 | Newsletter footer | S |
| 22 | Ticketing support admin | M |
| 23 | Recharts analytics admin | M |
| 24 | Stripe Connect retrait bancaire vendeur (wallet → virement) | L |

---

## Plan par sprints

> **Lecture rapide** : chaque sprint a un objectif clair, des tâches numérotées (réf. backlog #), des critères « terminé » et les écrans touchés.
>
> **Effort** : S = quelques heures · M = 1–2 j · L = 3–5 j · XL = 1–2 semaines

### Vue d'ensemble

```
[Sprint 0] Baseline ──► [Sprint 1] Prod-ready ──► [Sprint 2] Qualité
     ✅ fait                  P0                      P1
                                    │
                                    ▼
              [Sprint 3] C2C cœur ──► [Sprint 4] C2C avancé ──► [Sprint 5+] V2
                    P2 (UI + Stripe)      P2 (vidéo + états)         P3
```

| Sprint | Nom | Priorité | Durée indicative | Objectif |
|--------|-----|----------|------------------|----------|
| 0 | Baseline | — | ✅ fait | Vagues A→E + tableau de suivi |
| 1 | Prod-ready | P0 | 3–5 j | Déployer sans surprise (env, auth, cron, paiement, mails) |
| 2 | Qualité & conformité | P1 | 5–8 j | Fiabiliser : tests, rate limit, LCEN, temps réel |
| 3 | C2C — fondations | P2 | 5–8 j | Échange sécurisé utilisable (UI + caution Stripe) |
| 4 | C2C — production | P2 | 10–15 j | Preuves vidéo, machine à états complète, transporteurs |
| 5+ | Produit V2 | P3 | continu | Drop, S2, analytics, support… |

---

### Sprint 0 — Baseline ✅ (terminé)

**Objectif** : poser les fondations métier et le suivi.

| # | Tâche | Statut |
|---|-------|--------|
| — | Vagues A→E (DB, mutations, admin, C2C base, notifs) | ✅ |
| — | Tableau `SUIVI-FONCTIONNALITES.md` | ✅ |

---

### Sprint 1 — Prod-ready (P0)

**Objectif** : la plateforme peut tourner en production sans config manquante ni secret exposé.

**Durée** : 3–5 jours · **Statut global** : ⬜ non démarré

| # | Tâche | Effort | Critère « terminé » | Écrans / zones |
|---|-------|--------|---------------------|----------------|
| 1 | `.env.example` + commentaires | S | Fichier versionné, toutes vars documentées | Transversal |
| 6 | Régénérer clé Resend | S | Nouvelle clé en prod, ancienne révoquée | Transversal |
| 2 | Auth0 Action Post-Login | S | Rôles sync OK après login ; test owner/modérateur | `/admin/*` |
| 3 | Cron planifié | S | `POST /api/cron/maintenance` appelé 1×/h en prod | API |
| 4 | Stripe prod | M | Checkout bout-en-bout + webhook validé | `/boutique/checkout`, commandes |
| 5 | Resend prod | M | Domaine vérifié ; e-mail commande + notif testés | Notifications |

**Checklist de fin de sprint**

- [ ] Déploiement staging sans erreur 500 au login
- [ ] Achat test boutique → commande visible + e-mail reçu
- [ ] Cron exécuté (logs : annonces expirées / enchères clôturées)
- [ ] Lignes tableau §5, §9, §10 mises à jour (Statut ✅ ou 🔧→✅)

---

### Sprint 2 — Qualité & conformité (P1)

**Objectif** : réduire les risques techniques et juridiques avant d'ouvrir le C2C au public.

**Durée** : 5–8 jours · **Statut global** : ⬜ non démarré

| # | Tâche | Effort | Critère « terminé » | Écrans / zones |
|---|-------|--------|---------------------|----------------|
| 7 | Tests Vitest (cœur métier) | L | ≥ 15 tests : possession, permissions, machine à états | Services |
| 8 | Rate limiting | M | Limites sur webhook, cron, actions sensibles | API |
| 9 | ConnectionLog LCEN | M | Log connexion à chaque session Auth0 | Transversal |
| 10 | Nettoyage i18n | S | Plus de « bientôt » sur features livrées | Toute l'UI |
| 11 | Pusher messagerie | M | Message reçu sans refresh si Pusher actif | `/messages/[id]` |

**Checklist de fin de sprint**

- [ ] `pnpm test` passe en CI
- [ ] Smoke test messagerie temps réel OK
- [ ] Lignes §4 (Pusher), §10 (tests, LCEN, rate limit) mises à jour

---

### Sprint 3 — C2C fondations (P2, partie 1)

**Objectif** : un membre peut proposer un échange sécurisé et payer la caution jusqu'au bout.

**Durée** : 5–8 jours · **Statut global** : ⬜ non démarré

| # | Tâche | Effort | Critère « terminé » | Écrans / zones |
|---|-------|--------|---------------------|----------------|
| 12 | UI option `secured` | M | Checkbox + explication à `/echanges/proposer` | Échanges |
| 13a | Stripe Elements caution | L | Paiement confirmé côté client | `/securite/option-envoi` |
| 13b | Webhook PI caution | M | `payment_intent.succeeded` → statut AUTHORIZED en DB | API Stripe |
| — | Choix croisé sécurité | M | Chaque partie choisit le niveau pour le colis qu'elle **reçoit** | `/echanges/proposer` |

**Checklist de fin de sprint**

- [ ] Parcours test : proposition secured → caution payée → statut visible
- [ ] Lignes §4 et §7 (secured, caution, webhook) mises à jour

---

### Sprint 4 — C2C production (P2, partie 2)

**Objectif** : conformité spec sécurité (preuves, délais, litiges, suivi colis).

**Durée** : 10–15 jours · **Statut global** : ⬜ non démarré

| # | Tâche | Effort | Critère « terminé » | Écrans / zones |
|---|-------|--------|---------------------|----------------|
| 14 | Preuves vidéo in-app | XL | Caméra continue, jeton du jour, hash serveur | `/securite/envoi`, `/deballage` |
| 15 | Machine à états complète | L | J+5 ré-auth, prolongation 72 h, viz dynamique | `/securite/etats` |
| 16 | Agrégateur transporteurs | L | Suivi auto depuis numéro de tracking | `/securite/envoi` |
| 17 | DisputeResolution | M | Résolution admin + historique horodaté | Admin modération |

**Checklist de fin de sprint**

- [ ] Parcours C2C complet testé de bout en bout (2 comptes)
- [ ] Purge preuves 60 j vérifiée via cron
- [ ] Maturité C2C estimée ≥ 80 % dans la synthèse

---

### Sprint 5+ — Produit V2 (P3)

**Objectif** : fonctionnalités non bloquantes pour la mise en ligne initiale.

| # | Tâche | Quand | Notes |
|---|-------|-------|-------|
| 18 | Admin CRUD cartes / Payload CMS | Après S4 | Remplace seed Prisma |
| 19 | Drop événement | Q suivant | Réservation ou achat limité |
| 20 | Saison 2 | Q suivant | Déblocage catalogue S02 |
| 21 | Newsletter footer | Quick win | Form branché Resend |
| 22 | Ticketing support | Moyen terme | `/admin/support` |
| 23 | Recharts admin | Moyen terme | KPIs graphiques |
| 24 | Stripe Connect | Hors V1 | Marketplace encaissement — **hors scope** |

---

### Suivi sprint (tableau de bord)

> Cocher au fil de l'eau. Mettre à jour la colonne **Sprint actif** en tête de doc si besoin.

| Sprint | Statut | Date début | Date fin | Commentaire |
|--------|--------|------------|----------|-------------|
| 0 Baseline | ✅ Terminé | — | 2026-06-16 | Vagues A→E |
| 1 Prod-ready | ⬜ À faire | | | |
| 2 Qualité | ⬜ À faire | | | |
| 3 C2C fondations | ⬜ À faire | | | |
| 4 C2C production | ⬜ À faire | | | |
| 5+ V2 | ⬜ Backlog | | | |

**Sprint actif recommandé** : **Sprint 1 — Prod-ready**

---

## Journal des mises à jour

| Date | Auteur | Changements |
|------|--------|-------------|
| 2026-06-16 | Audit initial | Création tableau · baseline post-vagues A→E · 47 pages · 5 routes API |
| 2026-06-16 | Plan sprints | Ajout § Plan par sprints (S0→S5+) · checklists · tableau de bord sprint |

<!-- Ajouter une ligne par livraison :
| YYYY-MM-DD | Nom | Description courte + lignes tableau modifiées |
-->

---

## Checklist rapide avant release

- [ ] Mettre à jour les lignes concernées (Statut + MAJ + Notes)
- [ ] Ajouter une entrée au **Journal des mises à jour**
- [ ] Recalculer la **Synthèse globale** si changement majeur
- [ ] Vérifier `.env` / configs listées en P0
- [ ] `pnpm typecheck` + smoke test manuel des écrans touchés
