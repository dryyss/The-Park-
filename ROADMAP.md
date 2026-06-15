# ROADMAP — The Park

Roadmap technique par phases, avec tickets de dev. Estimation indicative (jours) alignée sur le CDC. Facturation au forfait — voir devis `DEV-THEPARK-2026-002`.

Légende : ☐ à faire · 🔄 en cours · ✅ fait · 🔴 bloquant juridique/avenant

---

## Phase 0 — Fondations (≈10 j)

> Socle technique avant toute feature.

- ☐ **TP-001** Init Next.js 15 + TS strict + ESLint/Prettier + pnpm + structure de dossiers.
- ☐ **TP-002** Setup Prisma + PostgreSQL ; **modèle de données multi-versions** (User, Card, Season, Rarity, Version, Language, Ownership, CardState).
- ☐ **TP-003** Intégration **Auth0** (login, rôles, champ âge, flag consentement parental).
- ☐ **TP-004** Setup **Payload CMS v3** (collections : Card, Season, Rarity, Version, Language).
- ☐ **TP-005** Design system The Park : tokens, composants de base (Button, Card, Badge, Table, Input), layout + thème JDM.
- ☐ **TP-006** i18n FR/JA/EN (structure `messages/`, provider, sélecteur de langue).
- ☐ **TP-007** CI/CD Vercel/Clever Cloud (UE) + `.env.example` + secrets.

---

## Phase 1 — Collection & catalogue (≈32 j)

> Modules 1–5 du CDC : le cœur « collection ».

- ☐ **TP-101** Module 1 — Comptes & profils : profil collectionneur, visibilité, contrôle d'âge, **consentement parental < 15 ans**, gestion/suppression compte (RGPD).
- ☐ **TP-102** Module 2 — Catalogue & fiches : navigation saison/rareté, fiche carte HD + zoom + attributs, recherche (nom/marque/modèle/numéro).
- ☐ **TP-103** Module 3 — **Ma collection multi-versions** : possédé/manquant par carte ET version, quantités, états (Neuve→Abîmée), barres de complétion (rareté/version/saison).
- ☐ **TP-104** Module 4 — Filtres avancés : rareté/version/état/langue/type ; filtres collection (manquantes, doubles…) & marché ; tris.
- ☐ **TP-105** Module 5 — Import back-office : upload **Excel/CSV** ou API, mapping colonnes, **rapport d'import** (succès/erreurs), gestion saisons/raretés/versions/langues, **mise à jour sans rupture** des collections.
- ☐ **TP-106** Virtualisation des grandes grilles + chargement progressif.

---

## Phase 2 — Marketplace & échanges (≈34 j)

> Modules 6–8 : la dimension communautaire & marchande (sans paiement).

- ☐ **TP-201** Module 6 — Magasin par membre : ajout carte (version, langue, état, **prix indicatif**, quantité), distinction vendre/échanger, gestion (ajout/édition/retrait).
- ☐ **TP-202** Module 7 — Marketplace : « je cherche / je propose », filtres (dispo, note vendeur, version, état, langue, rareté), recherche par membre, affichage des offres.
- ☐ **TP-203** Module 8a — Échanges : espace « mes échanges », **double validation**, **vérification de possession**.
- ☐ **TP-204** Module 8b — **Chat contextualisé à l'échange** (Pusher), **sans messagerie libre** (protection mineurs).
- ☐ **TP-205** Module 8c — Avis & réputation après échange confirmé, **historique horodaté** (preuve litige).

---

## Phase 3 — Gamification & multilingue (≈11 j + option)

- ☐ **TP-301** Module 9 — Leaderboards (global/saison/raretés/versions), **badges automatiques**, tableau de bord personnel (Recharts).
- ☐ **TP-302** Option **Multilingue** complète FR/日本語/EN : bascule live, police Noto Sans JP, réglage profil, vérif que la mise en page tient dans les 3 langues.

---

## Phase 4 — Boutique officielle (option, ≈ chiffrée à part)

> Vente directe créateur, vrai paiement Stripe. Distincte de la marketplace.

- ☐ **TP-401** Modèle produits (displays/boosters/goodies, variantes, stock, visibilité, éditions limitées).
- ☐ **TP-402** Accueil boutique + fiche produit (badge **Officiel ✔** or, états de stock honnêtes).
- ☐ **TP-403** Panier officiel (séparé marketplace) + livraison offerte au seuil.
- ☐ **TP-404** Checkout 4 étapes : Coordonnées → Livraison (transporteurs) → **Paiement Stripe** → Confirmation (n° commande, e-mail Resend).
- ☐ **TP-405** Suivi de commande (timeline + tracking) + back-office créateur (produits/commandes/stock/ventes).
- 🔴 **TP-406** Conformité VAD : CGV boutique, droit de rétractation, mentions — *client/juriste*.

---

## Phase 5 — Back-office admin (≈ inclus modération + transverse)

> Console unifiée, rôles hiérarchiques.

- ☐ **TP-501** Shell admin (sidebar charbon, topbar, recherche globale) + **système de rôles** (Owner + 4 sous-rôles) avec masquage par permission **vérifié serveur**.
- ☐ **TP-502** Dashboard (KPI adaptés au rôle, files de travail) + gestion utilisateurs.
- ☐ **TP-503** Module 10 — **Modération renforcée** : file **priorisant les mineurs**, détail signalement + conversation, actions (blocage/ban/escalade), modération magasins/avis.
- ☐ **TP-504** Catalogue/import/gamification/langues côté admin.
- ☐ **TP-505** Boutique admin (produits, commandes, paiements Stripe lecture seule).
- ☐ **TP-506** Administrateurs + **matrice de permissions** + Conformité (RGPD/LCEN, journaux, audit) + Réglages (**Owner only**).

---

## Phase 6 — 🔴 Sécurité échanges C2C (AVENANT séparé)

> Brique conséquente. À chiffrer en avenant. Voir `docs/Plan-Securite-Echanges.md`.
> **Stratégie : livrer P0 (preuves vidéo, sans argent) d'abord** — n'enclenche pas le régime PSP.

### P0 — Preuves & machine à états (sans flux financier)
- ☐ **TP-601** Capture **vidéo guidée in-app** (étapes 1–5), continuité, hash SHA-256, horodatage serveur, **jeton du jour**.
- ☐ **TP-602** **Machine à états** transaction (timeouts non-expédition J+3, fenêtre 72 h, double-réception échange).
- ☐ **TP-603** Intégration **agrégateur transporteurs** (suivi auto, statut « livré » déclencheur).
- ☐ **TP-604** Stockage chiffré vidéos + **purge RGPD 60 j** (1 an si litige) + accès modération.
- ☐ **TP-605** Dossier de litige auto + écran d'arbitrage modération (grille de décision).

### P1 — 🔴 Couche financière (déclenche avenant juridique)
- 🔴 **TP-611** **Stripe Connect** + KYC membres + préautorisation **caution 100 % valeur** (`capture_method: manual`).
- 🔴 **TP-612** Logique **ré-autorisation J+5**, `GARANTIE_SUSPENDUE` si refus, capture/annulation selon arbitrage.
- 🔴 **TP-613** Choix **acheteur** (envoi sécurisé oui/non) + **choix croisé** sur l'échange + tarification des frais.
- 🔴 **TP-614** Webhooks Stripe (capturable, canceled, refunded, dispute/chargeback) idempotents + signature vérifiée.

### P2 — Renforts
- ☐ **TP-621** Analyse continuité/hash, détection collusion (graphe IP/appareil/carte).
- ☐ **TP-622** Score de fiabilité d'expédition + badges + paliers de preuves.
- ☐ **TP-623** Voie d'appel litige (second niveau).

---

## Phase 7 — Recette & déploiement (≈12 j)

- ☐ **TP-701** Tests métier critiques (machine à états, possession, permissions, webhooks).
- ☐ **TP-702** Audit accessibilité + perf (virtualisation, images HD).
- ☐ **TP-703** Recette client par jalon + corrections.
- ☐ **TP-704** Déploiement prod UE + monitoring + journalisation.

---

## Reporté en V2 (hors périmètre actuel)

- Forum communautaire complet (catégories, sujets, messagerie privée).
- Applications mobiles natives iOS/Android + scan de cartes.
- Intégrations marketplaces externes (prix de référence live).

---

## Ordre de démarrage recommandé sur Cursor

1. **Phase 0** entièrement (fondations + modèle multi-versions = la pièce structurante).
2. **Phase 1** (collection/catalogue) — valeur visible rapidement, base de tout le reste.
3. **Phase 2** (marketplace/échanges) puis **Phase 3** (gamification/multilingue).
4. **Phase 5** (admin) en parallèle dès que les données existent (modération nécessaire tôt).
5. **Phase 4** (boutique) selon priorité client.
6. **Phase 6** (sécurité C2C) : commencer **TP-601→605 (P0)** ; **P1 financier seulement après avenant + validation juriste**.
7. **Phase 7** en continu (tests) + recette finale.

> ⚠️ Ne pas démarrer la couche financière (P1, boutique paiement) sans le cadre juridique validé (PSP, KYC, CGV/CGU, RGPD).
