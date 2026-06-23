# The Park — Ce qui a avancé cette semaine
**Période : 16 → 23 juin 2026**  
**Pour : validation client · version non technique**

---

Bonjour,

Voici un résumé de ce qui a été livré ou corrigé sur la plateforme **The Park** cette semaine. L’objectif : que vous puissiez vous projeter sur ce qui est déjà utilisable, sans entrer dans le détail technique.

---

## Ma collection

- **Gestion plus fine des cartes** : on peut indiquer l’état de chaque exemplaire (comme neuf, excellent, bon, etc.) et ajuster les quantités directement depuis la fiche carte.
- **Meilleure lisibilité** : nom de la carte, édition (1ʳᵉ édition / illimitée), pourcentage de complétion de la saison — affichage corrigé pour qu’il soit cohérent avec ce que vous possédez vraiment.
- **Cartes gradées** : si un exemplaire est gradé (PSA, PCA, BGS, etc.), vous pouvez maintenant :
  - indiquer la **société** et la **note** ;
  - ajouter une **photo de la carte** et une **photo du certificat**.
- **Page d’accueil** : le carrousel des raretés reflète en temps réel les cartes que vous possédez (après chaque ajout ou retrait dans votre collection).

---

## Marketplace (entre membres)

- **Panier simplifié** : un seul parcours pour préparer un achat sur la marketplace.
- **Paiement avec le portefeuille** : possibilité d’acheter avec les crédits déjà chargés (sans repasser par Stripe à chaque fois, si le solde suffit).
- **Filtres utiles** : recherche par ville du vendeur, filtre sur les cartes de votre wishlist.
- **Vue par carte** : sur une fiche carte, vous voyez quels vendeurs proposent cette version.
- **Corrections** : livraison, panier après achat, affichage des frais — plusieurs points bloquants ont été réglés.

---

## Portefeuille (crédits)

- **Recharge sans plafond bas** : plus de blocage à 500 € — les montants plus élevés passent (dans la limite raisonnable du système).
- **Conditions générales** : avant de payer une recharge, il faut cocher l’acceptation des conditions de vente (obligatoire légalement).
- **Fiabilité** : corrections pour éviter les doubles crédits ou les erreurs de solde après paiement.

---

## Échanges entre membres

- **Proposer un échange** : vous pouvez cibler un membre par son **nom** (plus simple qu’avant).
- **Page Échanges** : meilleure organisation (échanges en cours, propositions reçues, annonces ouvertes).
- **Échanges sécurisés** : poursuite du travail sur les preuves vidéo et le suivi des colis (couche « sécurité » des envois).

---

## Badges & profil

- **Plus de badges** : le profil compte maintenant **14 objectifs** au lieu de 6 (première carte, collectionneur, première vente, premier achat, échanges, etc.).
- **Déblocage automatique** : les badges se débloquent seuls quand l’action est faite (ajout d’une carte, vente, recharge, etc.) — plus besoin d’une manipulation cachée.

---

## Messages & notifications

- **Messagerie** : les conversations sont regroupées par personne (plus lisible).
- **E-mails** : envoi d’un mail quand un colis est expédié.
- **Wishlist** : alerte quand une carte de votre liste est mise en vente sur la marketplace.

---

## Boutique officielle & admin

- **Back-office** : création de cartes plus fluide (confirmation après ajout, photos qui s’uploadent correctement en production).
- **Stockage des images** : fiabilisé pour l’hébergement en ligne (Vercel).

---

## Connexion & compte

- **Connexion / déconnexion** : parcours clarifié pour les visiteurs et les membres connectés.
- **Paramètres** : identité, adresses, préférences vendeur.
- **Profil** : affichage du rôle staff (admin) quand c’est le cas ; alignement avec la session de connexion.

---

## Stabilité & mise en ligne

- Plusieurs **corrections de déploiement** (site qui ne buildait pas sur Vercel) ont été traitées au fil de la semaine.
- **Performances** : chargement des pages fréquentes un peu amélioré (cache, rapprochement serveur / base de données).

---

## Ce que vous pouvez tester en priorité

| Zone | À vérifier |
|------|------------|
| Collection | Ajouter une carte, changer l’état, marquer « Gradée » + note + photos |
| Portefeuille | Recharge > 500 € avec case CGV |
| Marketplace | Panier → paiement wallet ou Stripe |
| Profil | Badges qui se débloquent après une action |
| Échanges | Proposer un échange en cherchant un membre par nom |

---

## Prochaine étape côté technique (pour info)

Les dernières évolutions (badges, gradation, ville vendeur) sont sur la version en ligne dès que le déploiement Vercel est vert. Aucune action n’est requise de votre part pour la base de données — c’est géré côté hébergement.

---

N’hésitez pas à nous remonter tout comportement qui vous semble incohérent en testant : capture d’écran + étapes (« j’ai cliqué ici, j’attendais X ») suffisent.

Bonne continuation,  
**L’équipe The Park**
