# E-mails transactionnels — The Park

Catalogue des templates, de leurs déclencheurs et des données dynamiques qu'ils consomment.

- **Charte & blocs** : [`src/server/notification/email-layout.ts`](../src/server/notification/email-layout.ts)
- **Templates notifications** : [`src/server/notification/email-templates.ts`](../src/server/notification/email-templates.ts)
- **Templates hors notification** : [`src/server/notification/transactional-emails.ts`](../src/server/notification/transactional-emails.ts)
- **Prévisualisation (dev)** : `http://localhost:3000/api/dev/emails` — galerie de tous les templates avec données de démo (404 en production)
- **Tests** : `test/unit/notification/email-templates.test.ts`

## Fonctionnement

Tous les envois passent par `sendTransactionalEmail()` (Resend). Aucun e-mail n'est envoyé si
`RESEND_API_KEY` / `RESEND_FROM_EMAIL` sont absents — le reste du parcours fonctionne normalement.

Un e-mail de notification est produit automatiquement par `dispatchNotification()` :

1. la préférence de notification du destinataire est vérifiée (`Paramètres → Notifications`) ;
2. la notification in-app et le web push partent ;
3. `buildNotificationEmail(type, payload, ctx)` construit sujet + HTML, et l'e-mail est envoyé.

Il n'y a donc **rien à câbler** pour un nouveau type : ajouter un `case` dans `buildSpec()` suffit.

Le contexte (`ctx`) est renseigné par `dispatchNotification` :

| Champ | Origine | Usage |
| --- | --- | --- |
| `recipientName` | `user.displayName` | « Salut Kenji, » |
| `locale` | `user.language` (FR/EN/JP/DE/US → fr/en/ja) | préfixe des liens absolus |
| `entityType` / `entityId` | appelant | lien d'action (même cible que la notification in-app) |
| `payload.actorName` | résolu depuis `actorId` si absent | « Yuki t'a écrit » |

## Charte

Chaque e-mail est construit par `renderEmail()` : fond charbon `#0e0e11`, panneau `#16161a`,
bandeau d'accent, **logo The Park** (`/icon-192.png` en URL absolue) + wordmark, pied de page
avec liens de navigation et réglage des notifications. Tables + styles inline uniquement
(compatibilité Gmail / Outlook / Apple Mail).

Accents disponibles (`tone`) : `brand` (carmin), `gold` (or — argent/officiel), `success` (vert),
`warning` (orange), `danger` (rouge), `trade` (bleu — social/échanges), `badge` (violet).

Blocs réutilisables : `blockPanel`, `blockData`, `blockAmount`, `blockCode`, `blockItems`,
`blockCardItem` (visuel de carte), `blockQuote`, `blockSteps`.

Toute donnée dynamique passe par `esc()` / `b()` : les saisies back-office (n° de suivi,
transporteur, n° de commande) ne peuvent pas injecter de HTML.

---

## Compte

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Bienvenue | Création du compte (`auth-sync.service`) | Nouveau membre | pseudo |
| Newsletter — confirmation (double opt-in) | Inscription newsletter | Visiteur | lien de confirmation, **fr/en/ja** |
| Newsletter — bienvenue | Clic sur le lien de confirmation | Abonné | lien de désinscription, **fr/en/ja** |

## Boutique officielle

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Confirmation de commande | Paiement Stripe encaissé | Acheteur | n° commande, lignes + SKU + quantités, sous-total, port, total, adresse, mode d'envoi |
| Commande en préparation | Statut → `PREPARING` | Acheteur | n° commande, transporteur, total |
| Commande expédiée | Statut → `SHIPPED` | Acheteur | n° de suivi, transporteur |
| Numéro de suivi ajouté | Suivi saisi **sans** changement de statut | Acheteur | n° de suivi, transporteur |
| Commande livrée | Statut → `DELIVERED` | Acheteur | n° commande |
| Commande annulée | Statut → `CANCELLED` | Acheteur | n° commande |
| Commande remboursée | Statut → `REFUNDED` | Acheteur | montant remboursé |
| Staff — nouvelle commande | Paiement encaissé | Owner + gestionnaires boutique | client, total, nb d'articles, lien back-office |

Un seul e-mail par action : si le statut change **et** que le suivi est renseigné, l'e-mail de
statut porte déjà le numéro de suivi.

## Marketplace (C2C)

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Carte vendue | Vente confirmée par l'acheteur | Vendeur | carte + visuel, montant, acheteur |
| Paiement reçu — à expédier | Pré-autorisation acquise | Vendeur | carte + visuel, montant, acheteur |
| Offre reçue | Offre sur une annonce | Vendeur | carte, montant proposé, auteur ⚠️ *non branché* |
| Annonce mise au panier | Ajout au panier | Vendeur | carte, acheteur |
| Annonce bientôt expirée | Cron d'expiration | Vendeur | carte, prix, échéance ⚠️ *non branché* |
| Colis expédié | Suivi saisi par le vendeur | Acheteur | n° de suivi, transporteur |
| Colis livré | Statut transporteur | Acheteur | — ⚠️ *non branché* |
| Fin de garantie imminente | Extension/échéance de garantie | Contrepartie | échéance |
| Litige ouvert | Ouverture d'un litige | Partie adverse | motif |
| Litige tranché | Décision du staff | Les deux parties | décision, montant ⚠️ *non branché* |
| Avis reçu | Avis publié | Membre évalué | note /5, commentaire, auteur |
| Facture d'achat | Checkout marketplace payé | Acheteur | n° facture, n° commande, lignes, total |
| Facture de vente | Checkout marketplace payé | Vendeur | n° facture, n° commande, lignes, total |

Les factures sont des documents comptables : pas de mention de désinscription.

## Enchères

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Surenchéri | Mise supérieure placée | Précédent meilleur enchérisseur | carte + visuel, nouveau montant |
| Enchère remportée | Clôture avec réserve atteinte | Gagnant | carte + visuel, montant à régler |
| Vente conclue | Clôture, réserve atteinte | Vendeur | carte, montant |
| Sans preneur | Clôture, réserve non atteinte | Vendeur | carte, prix de départ |

## Échanges

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Proposition reçue | Échange proposé | Destinataire | auteur, message, nb de cartes |
| Échange accepté | Acceptation | Initiateur | auteur + rappel des étapes d'envoi |
| Échange terminé | Double réception confirmée | Les deux membres | — |
| Caution autorisée | Pré-autorisation Stripe | Membre | montant bloqué |

## Communauté

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Demande d'ami | Demande envoyée | Destinataire | auteur |
| Demande acceptée | Acceptation | Demandeur | auteur |
| Nouveau message | Message en conversation | Participants | auteur, aperçu (160 car.) |

## Collection

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Carte wishlist en vente | Mise en vente d'une carte suivie | Membre | carte + visuel, prix |
| Alerte prix | Prix sous le seuil d'alerte | Membre | carte, prix, seuil |
| Trophée débloqué | Condition de badge remplie | Membre | libellé + description du badge |

## Portefeuille & support

| Template | Déclencheur | Destinataire | Données dynamiques |
| --- | --- | --- | --- |
| Bonus de parrainage | Filleul qualifié | Parrain + filleul | montant, code de parrainage |
| Récap portefeuille (générique) | À câbler (retrait, remboursement) | Membre | titre, message, montant |
| Réponse du support | Réponse staff sur un ticket | Auteur du ticket | sujet du ticket, aperçu de la réponse |

---

## Non branché à ce jour

Les templates existent et se prévisualisent, mais aucun code n'émet encore la notification :
`OFFER_RECEIVED`, `LISTING_EXPIRING`, `SHIPMENT_DELIVERED`, `DISPUTE_RESOLVED`.
Le jour où ces évènements sont implémentés, un `dispatchNotification({ type })` suffit à
déclencher l'e-mail.

## Langues

Les e-mails de notification sont rédigés en **français** (source de vérité), avec des liens
pointant vers la locale du destinataire. Seule la newsletter est traduite fr/en/ja.
Pour internationaliser le reste, extraire les libellés de `buildSpec()` vers un dictionnaire
par locale — la structure des templates n'a pas à changer.
