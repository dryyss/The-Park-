# Guide de recette — The Park

**Document destiné au client (Auguste Mathieu / Lighton)**  
**Version** : juin 2026 · **Plateforme** : The Park — collection, marketplace, boutique officielle  
**Prestataire** : Magar Développement

---

## 1. Objectif de ce document

Ce guide permet de **tester la plateforme de bout en bout** avant validation ou retours. Il liste les parcours prioritaires, ce qu’il faut vérifier visuellement, et ce qui reste en cours de développement.

**Durée estimée** : 2 à 4 h pour un premier passage complet (1 h pour le socle + marketplace + boutique).

---

## 2. Environnement de test

| Élément | Détail |
|--------|--------|
| **URL de recette (prod)** | https://the-park-omega.vercel.app |
| **Langues** | Français (FR), 日本語 (JA), English (EN) — sélecteur en haut à droite |
| **Navigateurs conseillés** | Chrome ou Edge (dernière version), test mobile en plus si possible |
| **Connexion** | Auth0 — bouton « Se connecter » / « Créer un compte » |

> **Important** : utilisez **toujours la même URL** que celle configurée dans Auth0. En cas d’échec de connexion, vérifiez que vous n’êtes pas sur une ancienne URL ou un miroir local.

### Prérequis pour les tests paiement

- **Boutique officielle** et **marketplace (panier)** : Stripe doit être actif sur l’environnement de recette.
- **Carte de test Stripe** (mode test uniquement) : `4242 4242 4242 4242` · date future · CVC quelconque.
- **E-mails** : si Resend est configuré, vérifiez aussi votre boîte mail (factures marketplace, notifications).

---

## 3. Comptes recommandés

Pour tester les interactions entre membres, prévoyez **au minimum 2 comptes** :

| Rôle | Usage |
|------|--------|
| **Compte A — Acheteur / collectionneur** | Collection, wishlist, achats marketplace, panier boutique |
| **Compte B — Vendeur** | Publier une annonce, recevoir notification panier / vente, crédit solde vendeur |

**Optionnel** : un compte **staff admin** (fourni par Magar Développement) pour la console `/admin`.

---

## 4. Légende des statuts

| Symbole | Signification |
|---------|---------------|
| ✅ | À tester — fonctionnalité livrée |
| ⚠️ | Partiel ou dépend d’une config externe (Stripe, Resend, Pusher…) |
| ❌ | Hors périmètre ou non finalisé — ne pas bloquer la recette sur ce point |

---

## 5. Parcours de test — Checklist

Cochez chaque case après test. Notez les anomalies en fin de document (section 8).

### 5.1 Accueil & navigation

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 1 | Ouvrir la page d’accueil `/` | Hero, stats, cartes mises en avant, dernières annonces marketplace | ☐ |
| 2 | Naviguer via le menu : Collection, Marketplace, Boutique, Échanges, Classements | Liens actifs, mise en page cohérente mobile + desktop | ☐ |
| 3 | Changer la langue (FR / JA / EN) | Textes traduits, pas de chaînes vides | ☐ |
| 4 | Se connecter / créer un compte | Retour sur le site, avatar visible en haut à droite | ☐ |
| 5 | Se déconnecter | Session fermée, accès membre masqué | ☐ |

### 5.2 Catalogue & fiche carte

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 6 | `/recherche` — filtrer par rareté / tri | Résultats cohérents | ☐ |
| 7 | Ouvrir une fiche `/carte/[slug]` | Image, rareté, versions, navigation prev/next | ☐ |
| 8 | **Connecté** — ajouter une carte à la collection (quantité, état) | Mise à jour visible sur `/collection` | ☐ |
| 9 | **Connecté** — ajouter à la wishlist | Formulaire : **saison, version, édition, état** demandés | ☐ |
| 10 | Vérifier `/wishlist` | Entrées avec saison, version, état, édition | ☐ |

### 5.3 Ma collection

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 11 | `/collection` — filtres et tri | Grille réactive, progression affichée | ☐ |
| 12 | Modifier quantité / état d’une carte possédée | Sauvegarde sans erreur | ☐ |
| 13 | Invité (non connecté) | Lecture seule, incitation à se connecter pour modifier | ☐ |

### 5.4 Marketplace — parcours vendeur

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 14 | `/vendre` — vérifier prérequis vendeur | Messages clairs si profil incomplet (âge, adresse…) | ☐ |
| 15 | Publier une annonce **vente** (carte possédée + prix) | Annonce visible onglet « On propose » | ☐ |
| 16 | `/dashboard` — pause / reprise / annulation annonce | Statuts mis à jour | ☐ |
| 17 | **Compte B** — recevoir notification quand une carte est mise au panier d’un autre membre | Notification in-app (+ e-mail si Resend actif) | ☐ |

### 5.5 Marketplace — panier & achat (flux récent)

> Distinct de la **boutique officielle** (badge or « Officiel ✔ »).

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 18 | **Compte A** — sur `/marketplace`, cliquer **« Ajouter au panier »** sur une annonce | Confirmation « Ajouté ✓ », lien panier | ☐ |
| 19 | Vérifier que l’annonce **disparaît** des listings publics (réservée) | Plus visible pour les autres membres | ☐ |
| 20 | `/marketplace/panier` — cocher/décocher des articles | Total recalculé ; **aucune case** = tout le panier part au paiement | ☐ |
| 21 | **Continuer →** vers `/marketplace/panier/recap` | Récap des articles sélectionnés | ☐ |
| 22 | **Payer avec Stripe** | Redirection Stripe → paiement test → page confirmation | ☐ |
| 23 | Page `/marketplace/panier/confirmation/[id]` | N° commande, n° facture, message succès | ☐ |
| 24 | `/marketplace/commandes` | Historique de l’achat | ☐ |
| 25 | **Compte A** — solde portefeuille en haut (icône 💳) | Montant visible à côté de l’icône | ☐ |
| 26 | **Compte B** — solde **gains vendeur** sur `/portefeuille` | Crédit après vente (montant net) | ☐ |
| 27 | **Compte B** — e-mail facture vendeur | Reçu si Resend configuré | ☐ |
| 28 | **Compte A** — e-mail facture acheteur | Reçu si Resend configuré | ☐ |
| 29 | Annuler paiement Stripe (bouton retour) | Retour recap, message annulation, annonce de nouveau disponible | ☐ |

### 5.6 Marketplace — mise en relation (sans achat)

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 30 | Annonce sans prix fixe — **Contacter** | Ouverture messagerie contextualisée | ☐ |
| 31 | Onglet « On cherche » + publier une recherche `/marketplace/recherche` | Annonce « recherchée » visible | ☐ |

### 5.7 Portefeuille crédits

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 32 | `/portefeuille` — recharge min. **5 €** (+ 5 % frais) | Redirection Stripe, crédit sur solde **dépôt** | ☐ |
| 33 | Historique des mouvements (recharge, achat…) | Lignes horodatées | ☐ |

### 5.8 Boutique officielle Lighton

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 34 | `/boutique` — badge **Officiel ✔** (or) | Distinction visuelle claire vs marketplace | ☐ |
| 35 | Fiche produit — **Ajouter au panier** | Panier boutique (`/boutique/panier`) | ☐ |
| 36 | Checkout `/boutique/checkout` | Paiement Stripe, commande dans `/boutique/commandes` | ☐ |

> Le panier boutique et le panier marketplace sont **séparés**.

### 5.9 Échanges & messagerie

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 37 | `/echanges/proposer` — proposition entre A et B | Échange visible des deux côtés | ☐ |
| 38 | Accepter / refuser / annuler | Statuts cohérents, historique | ☐ |
| 39 | `/messages` — fil lié à échange ou vente | **Pas de messagerie libre** entre membres | ☐ |
| 40 | Envoyer un message | Message visible, compteur notifs top bar | ☐ |
| 41 | `/notifications` — marquer lu | Badge mis à jour | ☐ |

### 5.10 Profil & paramètres

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 42 | `/profil` — stats, badges, avis | Affichage cohérent | ☐ |
| 43 | `/parametres` — nom, bio, slug, adresses | Sauvegarde OK | ☐ |
| 44 | Export données RGPD | Téléchargement JSON | ☐ |
| 45 | `/collectionneur/[slug]` — profil public d’un autre membre | Aperçu collection + contact | ☐ |

### 5.11 Enchères

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 46 | `/encheres` — liste des enchères actives | Compte à rebours visible | ☐ |
| 47 | Placer une enchère (connecté) | Mise à jour du prix courant | ☐ |

### 5.12 Classements & communauté

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 48 | `/classements` — podium + tableau | Classement cohérent | ☐ |
| 49 | `/trophees` — badges | Grille badges (connecté ou invité) | ☐ |
| 50 | `/aide` — FAQ | Contenu lisible par catégorie | ☐ |

### 5.13 Console admin (si accès staff fourni)

| # | Action | Résultat attendu | OK |
|---|--------|------------------|-----|
| 51 | Menu profil → **Console admin** | Accès selon rôle staff uniquement | ☐ |
| 52 | `/admin` — KPIs | Chiffres affichés | ☐ |
| 53 | Modules autorisés (modération, boutique, finances…) | Navigation filtrée par rôle | ☐ |

---

## 6. Points d’attention — Règles métier à valider

Merci de confirmer que le comportement correspond à votre vision produit :

1. **Marketplace entre membres**  
   - Achats via **panier → récap → Stripe** (pas le même panier que la boutique).  
   - Annonce **réservée** dès qu’elle est dans un panier.  
   - Vendeur **notifié** ; après paiement, **crédit immédiat** sur solde gains (retrait bancaire via Stripe Connect à venir).

2. **Boutique officielle**  
   - Vente directe Lighton, badge or, **vrai paiement Stripe**, stock géré.

3. **Pas de messagerie privée libre**  
   - Messages uniquement dans un contexte (échange, vente, contact vendeur).

4. **Protection mineurs**  
   - Contrôle d’âge à l’inscription ; consentement parental < 15 ans (à valider avec vos scénarios réels).

5. **Contenu**  
   - Uniquement cartes **Pocket Drifterz / The Park** — pas d’IP tierce.

---

## 7. Fonctionnalités partielles ou hors scope recette

Ne pas considérer comme bloquants pour cette recette :

| Zone | État | Commentaire |
|------|------|-------------|
| Envoi sécurisé C2C complet | ⚠️ Partiel | Caution Stripe amorcée ; preuves vidéo guidées in-app non finalisées |
| Suivi transporteur (La Poste, etc.) | ❌ | Non implémenté |
| Saison 2 / Drop | ⚠️ | Teasers volontaires |
| Temps réel chat (Pusher) | ⚠️ | Fonctionne en polling si Pusher absent |
| Tests automatisés E2E | ❌ | Recette manuelle uniquement |
| App mobile native | ❌ | Report V2 |

---

## 8. Remontée des anomalies

Pour chaque problème, merci de fournir :

```
Date :
Testeur :
URL exacte :
Compte utilisé (e-mail ou pseudo) :
Langue (FR/JA/EN) :
Navigateur / appareil :

Étapes pour reproduire :
1.
2.
3.

Résultat obtenu :

Résultat attendu :

Capture d’écran / vidéo (si possible) :

Priorité suggérée : Bloquant / Majeur / Mineur / Cosmétique
```

**Envoi des retours** : [à compléter — e-mail Magar Développement / canal convenu avec le client]

---

## 9. Synthèse de validation

| Zone | Validé | Réserves | Refus |
|------|--------|----------|-------|
| Navigation & i18n | ☐ | | |
| Collection & wishlist | ☐ | | |
| Marketplace (panier + Stripe) | ☐ | | |
| Portefeuille | ☐ | | |
| Boutique officielle | ☐ | | |
| Échanges & messages | ☐ | | |
| Profil & paramètres | ☐ | | |
| Admin (si testé) | ☐ | | |

**Nom et date du validateur client** : ___________________________

**Signature / accord oral** : ___________________________

---

## 10. Rappel des URLs utiles

| Page | URL |
|------|-----|
| Accueil | `/` |
| Marketplace | `/marketplace` |
| Panier marketplace | `/marketplace/panier` |
| Historique achats marketplace | `/marketplace/commandes` |
| Portefeuille | `/portefeuille` |
| Vendre | `/vendre` |
| Dashboard vendeur | `/dashboard` |
| Boutique officielle | `/boutique` |
| Panier boutique | `/boutique/panier` |
| Échanges | `/echanges` |
| Messages | `/messages` |
| Aide / FAQ | `/aide` |

---

*Document généré pour la recette client — The Park · Magar Développement · juin 2026*
