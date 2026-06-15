# The Park — Plateforme TCG

Plateforme web de **collection, échange et marketplace communautaire** pour le jeu de cartes à collectionner **The Park** (Trading Card Game · univers drift / JDM, créé par l'artiste Lighton).

> Réf. CDC : `CDC-THEPARK-2026-001` · Client : Auguste Mathieu · Prestataire : Magar Développement

---

## 🎯 Vision

Un suivi de collection riche (multi-versions, raretés, états), une marketplace de mise en relation entre membres, une boutique officielle du créateur, le tout dans un environnement sécurisé et conforme, avec une attention forte à la protection des mineurs.

**Inspiration fonctionnelle** : Pokécardex, One Piece Card Game. **Aucune ressource tierce reproduite** — uniquement le contenu fourni par le client.

---

## 🧱 Stack technique

| Domaine | Technologie |
|---|---|
| Front-end | **Next.js 15** (App Router), **React 19**, **TypeScript** |
| Back-end / données | **Prisma** + **PostgreSQL** (modèle multi-versions & marketplace) |
| Authentification | **Auth0** (comptes, âge, consentement parental) |
| CMS / contenu | **Payload CMS v3** (catalogue, saisons, versions) |
| Temps réel (chat) | **WebSocket / Pusher** (messagerie contextualisée à l'échange) |
| Visualisations | **Recharts** (statistiques, progression) |
| E-mails | **Resend** (validation, consentement, notifications) |
| Paiement (boutique) | **Stripe** (+ Stripe Connect pour la couche sécurité C2C) |
| Hébergement | **Vercel** ou **Clever Cloud** (UE) |

**Exigences transverses** : responsive (mobile-first), accessibilité de base, chargement progressif + virtualisation des grandes grilles de cartes, sécurité applicative (rate-limiting, journalisation).

---

## 📦 Périmètre fonctionnel

### Socle V1 enrichie (10 modules)
1. **Comptes & profils** — Auth0, profil collectionneur, visibilité, contrôle d'âge & consentement parental < 15 ans, RGPD.
2. **Catalogue & fiches cartes** — navigation par saison/rareté, fiche détaillée (visuel HD, zoom, attributs), recherche.
3. **Ma collection (multi-versions)** — possédé/manquant par carte ET par version, quantités, états (Neuve → Abîmée), complétion.
4. **Filtres avancés & recherche** — rareté, version, état, langue, type ; filtres collection & marché ; tris.
5. **Import & gestion catalogue (back-office)** — import Excel/CSV ou API, gestion saisons/raretés/versions/langues.
6. **Magasin par membre** — lister cartes à vendre/échanger, état, prix indicatif, quantité.
7. **Marketplace & recherche entre membres** — « je cherche / je propose », filtres marketplace, mise en relation.
8. **Échanges, avis & réputation** — double validation, chat contextualisé (pas de messagerie libre — protection mineurs), avis, historique horodaté.
9. **Classements, badges & statistiques** — leaderboards, badges automatiques, tableau de bord personnel.
10. **Administration & modération renforcée** — gestion users, file priorisant les signalements mineurs, modération magasins/avis, journaux.

### Options ajoutées
- **Traduction multilingue** FR / 日本語 / EN (interface).
- **Boutique officielle créateur** — vente directe de produits physiques (displays, boosters, goodies) avec **paiement Stripe**, panier, commandes, stock, suivi livraison. Distincte de la marketplace entre membres.

### Brique sécurité C2C (échanges postaux) — *avenant, voir roadmap*
Préautorisation (caution 100 % valeur) + **chaîne de preuves vidéo horodatées** (emballage → dépôt → suivi → unboxing) + machine à états + arbitrage litige. Voir `docs/Plan-Securite-Echanges.md`.

### Back-office admin
Console d'administration : **rôle Owner** + sous-rôles (Modérateur, Gestionnaire catalogue, Créateur/Boutique, Support) avec matrice de permissions. 15 modules (dashboard, users, modération, catalogue, import, boutique, gamification, langues, admins, rôles, conformité, réglages…).

---

## 🗂️ Structure de la collection (Saison 01 « Moteur Forgé »)

| Rareté | Symbole | Numérotation | Cartes |
|---|---|---|---|
| Communes | ◆ | 01–30 | 30 |
| Rares (holo) | ◈ | 31–50 | 20 |
| Ultra Rares (holo) | ✦ | 51–67 | 17 |
| Légendaires (holo & texture) | ❀ | 68–74 | 7 |
| Gold | ✸ | 75–76 | 2 |
| Carte unique | ✦✦ | 01/01 | 1 |

**Versions** : Standard · Reverse · Édition spéciale/première édition · Alternatives (illustrations alt., promos, collaborations, signées). Structure extensible (ajout saisons/raretés/versions sans rupture).

---

## 🎨 Identité visuelle

Univers **street / graffiti / sticker JDM** (« garage de nuit »). Voir `.cursorrules` pour les tokens.

- Carmin `#D6004F` (signature, CTA) · Rouge foncé `#900030` · Charbon `#1E2424` · Blanc cassé `#FBF4F6`
- Or `#E8B23A` réservé au signal **« Officiel ✔ / vente directe Lighton »** (boutique).
- Touches néon (vert/orange/rouge) = **statuts uniquement**.
- Typo : titres condensés/bold (esprit lettrage), corps lisible. Police JP : Noto Sans JP.

---

## 🔐 Conformité (cadrage)

- **Protection des mineurs** : contrôle d'âge, consentement parental < 15 ans (RGPD art. 8), chat encadré, modération priorisée.
- **RGPD** : consentement, droits d'accès/rectification/suppression, hébergement UE, journaux.
- **LCEN** : statut hébergeur, retrait contenus illicites, conservation journaux.
- **Marketplace entre membres = pure mise en relation** (aucun paiement) ; seules la **boutique** et la **couche sécurité C2C** font transiter de l'argent → **PSP agréé, KYC, CGV/CGU dédiées** (validation juriste).
- Documents légaux rédigés/validés côté client + juriste.

---

## 🚀 Démarrage

```bash
# Prérequis : Node 20+, pnpm, PostgreSQL, comptes Auth0 / Stripe / Resend
pnpm install
cp .env.example .env.local        # remplir les clés
pnpm prisma migrate dev           # schéma multi-versions
pnpm payload generate:types       # types CMS
pnpm dev                          # http://localhost:3000
```

Variables d'env attendues : `DATABASE_URL`, `AUTH0_*`, `STRIPE_*`, `PUSHER_*`, `RESEND_API_KEY`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_APP_URL`.

---

## 📁 Arborescence cible (indicative)

```
the-park/
├─ app/                 # Next.js App Router (routes, layouts)
│  ├─ (public)/         # catalogue, fiches, profils publics
│  ├─ (member)/         # collection, magasin, échanges, marketplace
│  ├─ (shop)/           # boutique officielle + checkout
│  ├─ (admin)/          # back-office (rôles)
│  └─ api/              # route handlers / webhooks (Stripe, transporteurs)
├─ components/          # UI réutilisable (design system The Park)
├─ lib/                 # clients (prisma, stripe, auth0, pusher, resend)
├─ server/             # logique métier, machine à états, services
├─ prisma/              # schema.prisma + migrations
├─ cms/                 # Payload collections (cartes, saisons, versions)
├─ messages/            # i18n FR / JA / EN
└─ docs/                # CDC, devis, plan sécurité, roadmap
```

---

## 📚 Docs liées

- `docs/ROADMAP.md` — phases & tickets de dev
- `docs/Plan-Securite-Echanges.md` — dispositif anti-litige C2C
- `.cursorrules` — conventions & guidage IA Cursor
- CDC / Devis / Contrat — `CDC-THEPARK-2026-001`, `DEV-THEPARK-2026-002`

---

*Magar Développement · auto-entrepreneur · SIRET 908 058 092 00028 · TVA non applicable art. 293 B CGI*
