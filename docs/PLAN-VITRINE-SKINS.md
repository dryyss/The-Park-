# Plan complet — Vitrine du collectionneur + Système de skins

> Statut : **plan validé, en attente de déclenchement** (option payante client).
> Rédigé le 2026-07-02. À exécuter tel quel si le client valide l'option.

## 1. Objectif & décisions validées

Remplacer l'« Aperçu de la collection » actuel (12 premières cartes affichées automatiquement,
[collectionneur/[slug]/page.tsx:43](../src/app/[locale]/collectionneur/[slug]/page.tsx#L43)) par une
**vitrine curatée** : le collectionneur choisit lui-même les cartes à mettre en avant, les ordonne, et
peut leur appliquer des **skins** (cadres / effets / animations) achetés avec des crédits.

| Décision | Choix validé |
|----------|--------------|
| Obtention des skins | **Achat avec crédits** (portefeuille Stripe existant) |
| Taille de la vitrine | **Plafond souple 24 cartes** |
| Cumul de skins | **Combinables** : 1 cadre + 1 effet + 1 animation par carte |
| Skins visibles | **Uniquement dans la vitrine** (pas dans la collection, le catalogue ou la marketplace) |

## 2. Périmètre

**Dans le périmètre :**
- Modèle de données vitrine + skins + inventaire skins débloqués.
- Éditeur de vitrine (sélection, réordonnancement, assignation de skins) sur son propre profil.
- Affichage public de la vitrine sur `/collectionneur/[slug]`.
- Moteur de rendu des skins (couches CSS/overlay) appliqué **seulement** en contexte vitrine.
- Boutique de skins (catalogue + achat débité du portefeuille crédits).
- i18n fr/en/ja (via l'agent i18n-copywriter).

**Hors périmètre (à cadrer plus tard si besoin) :**
- Skins débloqués par badges/succès (l'archi le prévoit mais on ne branche que l'achat crédits).
- Skins animés lourds type WebGL/vidéo (on reste sur CSS/SVG pour la perf).
- Échange/revente de skins entre membres.

## 3. Modèle de données (Prisma)

Nouvelle migration `prisma/migrations/<timestamp>_showcase_skins/`.

```prisma
enum SkinKind {
  FRAME      // cadre / bordure
  EFFECT     // holo, glow, texture (overlay)
  ANIMATION  // animation CSS (pulse, shine, float…)
}

/// Catalogue des skins disponibles à l'achat.
model Skin {
  id          String   @id @default(cuid())
  /// Clé technique stable utilisée par le moteur de rendu (ex. "frame-neon", "effect-holo-rainbow").
  key         String   @unique
  kind        SkinKind
  name        String
  description String?
  /// Prix en crédits (EUR). 0 = gratuit/offert.
  priceEur    Decimal  @db.Decimal(10, 2) @default(0)
  /// Rareté visuelle du skin (tri boutique, badge premium). Réutilise les codes de rareté existants ou libre.
  tier        String?
  /// Visuel d'aperçu boutique.
  previewUrl  String?
  active      Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  userSkins   UserSkin[]
}

/// Skins débloqués par un utilisateur (inventaire).
model UserSkin {
  id         String   @id @default(cuid())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId     String
  skin       Skin     @relation(fields: [skinId], references: [id], onDelete: Cascade)
  skinId     String
  unlockedAt DateTime @default(now())
  /// Trace l'achat crédits correspondant (idempotence).
  ledgerEntryId String? @unique

  @@unique([userId, skinId])
  @@index([userId])
}

/// Carte mise en avant dans la vitrine publique du collectionneur.
model ShowcaseItem {
  id               String   @id @default(cuid())
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId           String
  collectionItem   CollectionItem @relation(fields: [collectionItemId], references: [id], onDelete: Cascade)
  collectionItemId String
  sortOrder        Int      @default(0)
  /// Skins appliqués (nullable = pas de skin). Combinables : 1 par catégorie.
  frameSkinId      String?
  effectSkinId     String?
  animationSkinId  String?
  createdAt        DateTime @default(now())

  @@unique([userId, collectionItemId])
  @@index([userId, sortOrder])
}
```

**Ajouts sur modèles existants :**
- `enum WalletEntryType` : ajouter `SKIN_PURCHASE`.
- `model WalletLedgerEntry` : ajouter `skinId String?` (référence achat, pour idempotence/audit) + `@@index([skinId])`.
- `model User` : relations inverses `showcaseItems ShowcaseItem[]`, `userSkins UserSkin[]`.
- `model CollectionItem` : relation inverse `showcaseItems ShowcaseItem[]`.

> ⚠️ Migration idempotente (cf. commit `7f7276f` — contrainte P3018 sur ce projet) : `CREATE TABLE IF NOT EXISTS`,
> `ADD COLUMN IF NOT EXISTS`, `ALTER TYPE ... ADD VALUE IF NOT EXISTS` pour l'enum.

## 4. Couche serveur

### 4.1 `src/server/showcase/showcase.service.ts` (nouveau)
- `getShowcase(userId): Promise<ShowcaseEntry[]>` — items ordonnés + carte résolue (image, nom, rareté via
  la même projection que `CollectionCard`) + skins résolus (`key` de chaque couche). Utilisé par la page publique.
- `getShowcaseEditorData(userId)` — vitrine actuelle **+** cartes possédées éligibles (`getUserCollection(userId, { segment: "owned" })`) **+** inventaire skins (`getUserSkins`).
- `SHOWCASE_MAX = 24` (constante partagée).

### 4.2 `src/server/showcase/showcase.actions.ts` (nouveau, `"use server"`)
- `setShowcaseCards(collectionItemIds: string[])` — remplace la vitrine.
  Gardes : auth ; possession vérifiée (chaque `collectionItemId` appartient à l'utilisateur) ; `length ≤ SHOWCASE_MAX` ; dé-doublonnage. Écrit `sortOrder` selon l'ordre reçu. `revalidatePath` du profil.
- `reorderShowcase(orderedIds: string[])` — met à jour `sortOrder`.
- `setShowcaseItemSkins(collectionItemId, { frameSkinId?, effectSkinId?, animationSkinId? })` —
  garde : chaque skin doit être **possédé** (`UserSkin`) et de la bonne `kind`. Null = retire la couche.

### 4.3 `src/server/skin/skin.service.ts` (nouveau)
- `getSkinCatalog()` — skins `active`, triés, avec flag `owned` pour le viewer.
- `getUserSkins(userId)` — inventaire.

### 4.4 `src/server/skin/skin.actions.ts` (nouveau, `"use server"`)
- `purchaseSkin(skinId)` :
  1. Auth + charge le skin (`active`).
  2. Refus si déjà possédé (`UserSkin` unique) → renvoie `ALREADY_OWNED`.
  3. Vérifie solde via `getWalletSpendableBalanceEur`.
  4. Transaction : débit portefeuille (nouvelle fonction `debitWalletForSkin` calquée sur `debitWalletForSale`,
     type `SKIN_PURCHASE`, `skinId` pour idempotence) **+** création `UserSkin` liée au `ledgerEntryId`.
  5. Codes d'erreur alignés sur l'existant : `UNAUTHORIZED`, `ALREADY_OWNED`, `INSUFFICIENT_CREDIT`, `SKIN_UNAVAILABLE`.

### 4.5 `src/server/wallet/wallet.service.ts` (extension)
Ajouter `debitWalletForSkin({ userId, skinId, amountEur })` — même logique de priorité dépôt→gains que
`debitWalletForSale`, idempotence par `(skinId, type: SKIN_PURCHASE)`.

## 5. Couche UI

### 5.1 Moteur de rendu des skins
`src/components/showcase/showcase-card.tsx` (client) — enveloppe `CollectionCardTile` / `CatalogCardFrame`
et applique les couches selon les `key` de skin :
- **FRAME** → remplace/augmente la bordure de `CatalogCardFrame` (variable `--rarity-color` déjà en place, on ajoute `--skin-frame-*`).
- **EFFECT** → overlay absolu `pointer-events-none` (dégradé holo, glow, texture) au-dessus de l'image.
- **ANIMATION** → classe utilitaire déclenchant un keyframe.

`src/lib/skins.ts` — registre `key → { className, style, layer }`. **Toutes les définitions visuelles vivent
ici** (une seule source de vérité), keyframes ajoutés dans [globals.css](../src/app/globals.css).
Le moteur n'est monté que par la vitrine → skins invisibles ailleurs, garanti par construction.

### 5.2 Vitrine publique
Dans [collectionneur/[slug]/page.tsx](../src/app/[locale]/collectionneur/[slug]/page.tsx) :
- Remplacer le bloc `previewCards` (`.slice(0,12)`) par `getShowcase(profile.userId)`.
- Rendu via `ShowcaseCard`. Section vide → fallback discret (ou masquée) si le collectionneur n'a rien mis.
- Si `isOwnProfile`, afficher un bouton **« Éditer ma vitrine »**.

### 5.3 Éditeur de vitrine
`src/components/showcase/showcase-editor.tsx` (client) — accessible sur son propre profil (route dédiée
`/collectionneur/[slug]/vitrine` ou panneau modal) :
- Grille des cartes possédées → toggle « ajouter/retirer » (compteur `x/24`, désactive au-delà).
- Réordonnancement drag & drop (lib légère, ex. `@dnd-kit`, ou flèches ↑/↓ si on veut éviter une dépendance).
- Par carte en vitrine : 3 sélecteurs (cadre / effet / animation) limités à l'inventaire possédé, avec
  aperçu live via `ShowcaseCard`. Lien « Débloquer plus de skins » → boutique.
- Sauvegarde via les server actions (optimiste + `revalidatePath`).

### 5.4 Boutique de skins
`/skins` (ou onglet dans le portefeuille) : grille du catalogue, aperçu, prix en crédits, solde affiché,
bouton **Acheter** → `purchaseSkin`. États : possédé / solde insuffisant (CTA recharger crédits) / acheter.

## 6. i18n
Nouveau namespace `showcase` + `skins` dans `fr.json` (source), puis parité stricte en/ja via l'agent
**i18n-copywriter** (cf. règle projet). Chaînes : titres vitrine, éditeur (ajouter/retirer, x/24, sélecteurs),
boutique (acheter, possédé, solde insuffisant), erreurs (`ALREADY_OWNED`, `INSUFFICIENT_CREDIT`…).

## 7. Sécurité & cas limites
- **Possession vérifiée côté serveur** à chaque action (jamais faire confiance au client).
- **Skin non possédé** assigné → rejeté (garde `kind` + `UserSkin`).
- **Carte retirée de la collection** (`CollectionItem` supprimé) → `onDelete: Cascade` nettoie la vitrine.
- **Double achat** → contrainte unique `UserSkin(userId, skinId)` + idempotence ledger par `skinId`.
- **Cap 24** appliqué serveur, pas seulement UI.
- **Solde concurrent** : débit dans la même transaction que la création `UserSkin`.
- **Perf** : plafond 24 + skins CSS only → pas de risque de page lourde.

## 8. Tests (Vitest, cf. `test/unit`)
- `setShowcaseCards` : rejet si carte non possédée / au-delà de 24 / doublons ; ordre respecté.
- `setShowcaseItemSkins` : rejet skin non possédé / mauvaise `kind`.
- `purchaseSkin` : succès (débit + inventaire), `ALREADY_OWNED`, `INSUFFICIENT_CREDIT`, idempotence.
- `debitWalletForSkin` : priorité dépôt→gains, idempotence par skinId.
- Rendu `ShowcaseCard` : couches appliquées selon les keys ; aucune couche hors vitrine.

## 9. Découpage en lots livrables

| Lot | Contenu | Dépend de |
|-----|---------|-----------|
| **1 — Vitrine** | Migration `ShowcaseItem`, service + actions vitrine, affichage public, éditeur (sélection + ordre), i18n | — |
| **2 — Skins (rendu)** | Modèles `Skin`/`UserSkin`, `src/lib/skins.ts` + moteur `ShowcaseCard`, keyframes globals.css, assignation dans l'éditeur | Lot 1 |
| **3 — Boutique crédits** | `debitWalletForSkin`, `purchaseSkin`, catalogue + page boutique, seed d'un jeu de skins | Lot 2 |

Chaque lot est autonome et déployable (Lot 1 apporte déjà la valeur « vitrine curatée » sans skins).

## 10. Estimation indicative
- Lot 1 : ~1–1,5 j (dont éditeur drag & drop).
- Lot 2 : ~1,5–2 j (design des skins = variable selon nombre/qualité des effets).
- Lot 3 : ~1 j (réutilise la mécanique crédits existante).
- i18n + tests + polish : ~0,5 j.

> Le design visuel des skins (combien, quels effets) est le principal facteur de variabilité —
> à cadrer avec le client au lancement du Lot 2.

## 11. Points à confirmer au lancement
- Jeu de skins initial (nombre, thèmes, prix en crédits) — pour le seed.
- Route de la boutique : page `/skins` dédiée ou onglet dans le portefeuille ?
- Drag & drop via dépendance (`@dnd-kit`) accepté, ou flèches ↑/↓ sans dépendance ?
- Comportement vitrine vide côté public (masquée vs message d'invitation).
