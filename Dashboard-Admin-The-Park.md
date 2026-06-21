# The Park — Dashboard d'administration : fonctionnalités, implémentation & optimisation

Document de référence pour concevoir le back-office le plus **complet** et **intuitif** possible. Pour chaque domaine : ce qu'il fait, comment l'implémenter (stack du projet : Next.js 15 / Prisma / PostgreSQL / Stripe / Auth0 / Payload / Pusher / Resend), et comment l'optimiser.

> Principe directeur : **l'admin est un poste de pilotage, pas une collection d'écrans.** Tout doit être atteignable en ≤ 2 clics, chaque donnée doit être actionnable (un chiffre → un clic → la liste filtrée correspondante), et chaque action sensible doit être tracée et permissionnée côté serveur.

---

## 0. Architecture transverse (le socle de l'intuitivité)

| Brique | Implémentation | Optimisation |
|---|---|---|
| **Shell unifié** | Layout `(admin)/layout.tsx` : sidebar charbon groupée par domaines + topbar (recherche, notifs, rôle). | Sidebar à sections repliables + favoris épinglables par l'admin. |
| **Command palette ⌘K** | Composant global : recherche actions + entités (user, commande, carte, litige) en un raccourci. | Index de recherche (Postgres `tsvector` ou Meilisearch) ; résultats typés avec navigation directe. |
| **Recherche globale** | Barre topbar → recherche cross-entités. | Debounce, résultats groupés par type, raccourcis clavier. |
| **Système de rôles** | Auth0 + table `AdminRole`/`Permission` ; middleware vérifiant la permission **côté serveur** sur chaque action. | Permissions **masquent** les modules (pas griser) ; cache des permissions en session. |
| **Notifications temps réel** | Pusher : nouveaux signalements, commandes, litiges, ruptures stock. | Centre de notifs filtrable + préférences par admin (quels événements). |
| **Files de travail (work queues)** | Vues dédiées : « à traiter » pour signalements, commandes, litiges, SAV. | Tri par priorité/SLA, badge de compteur live, attribution à un admin. |
| **Audit log** | Table `AuditLog` : qui / quoi / quand / avant-après, sur chaque action sensible. | Immuable, exportable, filtrable ; visible dans Conformité. |
| **Actionabilité des chiffres** | Chaque KPI = lien vers la liste filtrée. | Aucun chiffre « mort » : toujours cliquable. |
| **États vides & chargement** | Empty states explicites + skeletons. | Guides contextuels (« aucun litige — tout va bien »). |

---

## 1. Tableau de bord (accueil, adaptatif par rôle)

**Fonctionnalités**
- **KPI temps réel** : membres actifs, nouvelles inscriptions (j/7j/30j), échanges en cours, signalements ouverts, litiges C2C, commandes du jour, CA boutique, enchères actives, ruptures de stock.
- **Files de travail prioritaires** en accès direct (signalements mineurs en tête, commandes à expédier, litiges à arbitrer, tickets SAV).
- **Flux d'activité récente** (timeline).
- **Graphiques de tendance** : inscriptions, ventes, échanges, CA (Recharts).
- **Contenu filtré selon le rôle connecté** (un Modérateur voit la modération, pas les finances).

**Implémentation**
- Données agrégées via des **requêtes Prisma optimisées** + vues SQL matérialisées pour les KPI lourds.
- Rafraîchissement : KPI critiques en live (Pusher), le reste en polling/SWR.
- Composant `KpiCard` réutilisable (valeur, delta vs période précédente, sparkline, lien).

**Optimisation**
- **Vues matérialisées** rafraîchies périodiquement (CA, classements) pour éviter de recalculer à chaque chargement.
- **Plage de dates globale** (today / 7j / 30j / custom) qui pilote tout le dashboard.
- Widgets **réorganisables** et masquables par l'admin (préférences persistées).
- Cache court côté serveur (revalidate) sur les agrégats non critiques.

---

## 2. Ventes & finances (boutique revendeur)

> Auguste est **revendeur** (achat-revente ou dépôt-vente). Le module finance doit refléter ce statut.

**Fonctionnalités**
- **Suivi des ventes** : liste des commandes, CA brut/net, panier moyen, top produits, taux de conversion.
- **Graphiques** : CA par jour/semaine/mois, par catégorie (displays/boosters/goodies), comparaison de périodes.
- **Calcul charges & revenus** :
  - Revenus = ventes encaissées.
  - Charges = **coût d'achat des produits** (prix de gros fournisseur), **frais Stripe**, **frais d'expédition**, **commissions plateforme** éventuelles, **cotisations** (indicatif), **remboursements**.
  - **Marge brute** (vente − coût d'achat) et **marge nette** (− frais).
- **Gestion TVA** : selon le statut d'Auguste (franchise art. 293 B ou TVA applicable). Affichage HT/TTC, taux, total TVA collectée.
- **Facturation** : génération de factures de vente conformes (numérotation, mentions), avoirs/remboursements.
- **Exports comptables** : CSV/Excel des ventes, TVA, marges, pour le comptable (+ éventuel format compatible logiciel compta).
- **Reversements** (si dépôt-vente) : calcul commission, montant à reverser au créateur, historique des reversements, statut (dû/payé).

**Implémentation**
- Modèle `Order`, `OrderItem`, `Product` (avec `costPrice` = prix de gros, `salePrice`), `Payment`, `Refund`, `Payout`.
- **Stripe** comme source de vérité des encaissements ; réconciliation via webhooks (`charge.succeeded`, `refund`, `payout`).
- Calculs financiers dans une **couche service** (`server/finance/`), jamais dans l'UI — testée unitairement (TVA, marges, arrondis).
- Reversements créateur via **Stripe Connect** (transfers) si dépôt-vente.

**Optimisation**
- **Tableau de bord financier** dédié avec sélecteur de période + comparaison N-1.
- Pré-calcul des marges à la création de commande (snapshot du coût d'achat au moment de la vente → fiabilité historique même si le prix de gros change).
- Alertes : marge sous un seuil, produit vendu à perte, écart de réconciliation Stripe.
- Export programmé (mensuel) envoyé par e-mail au comptable (Resend).

---

## 3. Gestion des stocks

**Fonctionnalités**
- Liste produits avec **niveau de stock**, seuils, statut (en stock / faible / rupture / épuisé).
- **Mouvements de stock** : entrées (réassort), sorties (ventes), retours, pertes/casse.
- **Alertes** stock faible / rupture (notif + e-mail).
- Gestion des **variantes** (taille/édition) et des **éditions limitées** (quota).
- **Réservation** de stock pendant le checkout (anti-survente) et pour les enchères gagnées.
- Historique et valorisation du stock (valeur immobilisée au prix d'achat).

**Implémentation**
- Modèle `StockMovement` (type, quantité, raison, ref commande/retour) → stock = somme des mouvements (traçable, auditable) plutôt qu'un simple compteur.
- Décrément **atomique** transactionnel à la validation de commande (éviter la survente en concurrence).
- Réservation temporaire avec TTL (libérée si paiement non finalisé).

**Optimisation**
- **Stock = source unique** (ledger de mouvements) → réconciliation et audit faciles.
- Prévision de réassort simple (vitesse d'écoulement → date de rupture estimée).
- Vue « à réapprovisionner » triée par urgence.

---

## 4. Gestion des paiements (acheteur ↔ revendeur ↔ créateur)

**Fonctionnalités**
- **Encaissements acheteur** : suivi des paiements Stripe (statut, montant, méthode), reçus.
- **Remboursements** : total/partiel, motif, traçabilité ; impact stock (retour) et compta (avoir).
- **Chargebacks / litiges bancaires** : réception via webhook, dossier de preuves, suspension préventive.
- **Reversements créateur** (dépôt-vente) : calcul, planification, exécution, justificatif.
- **Caution C2C** (échanges sécurisés) : préautorisations, captures, annulations (voir §8).
- **KYC** : statut de vérification Stripe Connect du revendeur (et du créateur si reversements).
- **Réconciliation** : rapprochement encaissements Stripe ↔ commandes ↔ payouts.

**Implémentation**
- **Stripe** central : `PaymentIntent`, `Refund`, `Transfer`, `Payout`, `Dispute`. Webhooks **signés + idempotents**.
- Modèle `Payment`, `Refund`, `Payout`, `Dispute` reliés aux `Order`/`Trade`.
- Statuts financiers reflétés en base, jamais déduits côté client.

**Optimisation**
- **Vue paiements unifiée** (boutique + caution C2C + reversements) avec filtres par statut/type.
- File « anomalies » : paiements non réconciliés, payouts en échec, disputes ouvertes.
- Garde-fous : double confirmation pour un remboursement au-delà d'un seuil, journalisation systématique.

---

## 5. Salle des enchères (nouvelle feature — à cadrer)

> ⚠️ Si de l'argent transite → régime PSP/KYC comme la boutique. À chiffrer en avenant.

**Fonctionnalités**
- Création/gestion d'**enchères** (carte/lot, prix de départ, prix de réserve, pas d'enchère, date début/fin).
- **Enchères en temps réel** (offres live), prolongation anti-snipe (extension si offre en dernière minute).
- Suivi des **participants**, historique des offres, gagnant.
- **Paiement du gagnant** (préautorisation à l'enchère puis capture) + délai de paiement.
- Gestion des **impayés** (relance, pénalité, remise en vente).
- Modération des enchères (annulation, signalement, anti-collusion/shill bidding).

**Implémentation**
- Modèle `Auction`, `Bid`, `AuctionResult`. Offres temps réel via **Pusher** ; validation serveur (montant > meilleure offre + pas).
- Clôture pilotée serveur (job planifié), pas par le client.
- Paiement gagnant via Stripe (préautorisation à l'inscription/à l'offre max, capture à la clôture).

**Optimisation**
- **Anti-snipe** (prolongation auto) + **anti-shill** (détection comptes liés qui font monter les prix).
- Plafond d'enchère selon KYC/réputation ; dépôt de garantie pour enchérir au-delà d'un seuil.
- File admin « enchères à surveiller » (offres anormales, impayés).

---

## 6. Gestion des utilisateurs & profils

**Fonctionnalités**
- Table membres : pseudo, e-mail, statut, réputation, date d'inscription, **mineur/majeur**, KYC.
- Fiche membre 360° : collection, magasin, échanges, commandes, enchères, signalements, sanctions, historique.
- Actions : avertir, suspendre, bannir, restaurer, **vérifier âge / consentement parental**, forcer reset.
- Filtres : statut, mineurs, réputation, signalés, KYC, activité.
- Gestion RGPD : export des données, suppression de compte.

**Implémentation**
- Source d'identité Auth0 + miroir `User` en base (profil, flags). 
- Actions de modération écrivent dans `AuditLog` + `Sanction`.
- Vue 360° = agrégation multi-tables avec onglets (lazy-load par onglet).

**Optimisation**
- **Score de risque** par membre (signalements, litiges, retours) visible d'un coup d'œil.
- Actions groupées (bulk) avec confirmation.
- Liens croisés : depuis une commande/un litige → la fiche membre, et inversement.

---

## 7. Modération renforcée (priorité protection des mineurs)

**Fonctionnalités**
- **File de signalements priorisant les mineurs** (mise en avant visuelle nette, en tête).
- Détail d'un signalement : contexte, **conversation liée à l'échange**, contenu signalé, historique de l'utilisateur, score de risque.
- Actions rapides : blocage immédiat, bannissement, classement sans suite, escalade, avertissement.
- **Filtrage par mots-clés**, journal des conversations/échanges.
- Modération des **magasins**, **avis**, **enchères**, **annonces marketplace**.
- File SLA (temps de traitement, alertes retard).

**Implémentation**
- Modèle `Report` (type, cible, signaleur, priorité auto si mineur impliqué), `ModerationAction`.
- Priorisation auto : si mineur partie prenante → priorité haute + flag rouge.
- Chat lié à l'échange consultable en lecture par la modération (Pusher/historique).

**Optimisation**
- **Filtres de mots-clés** et détection de patterns (grooming, contournement de la messagerie encadrée) → alertes auto.
- Attribution des signalements à un modérateur (évite le double traitement).
- Macros de décision (motifs pré-rédigés) + traçabilité.

---

## 8. Échanges & sécurité C2C (voie postale)

> Voir `docs/Plan-Securite-Echanges.md`. Cœur anti-arnaque.

**Fonctionnalités**
- Supervision des échanges : machine à états, étapes de preuve, suivi transporteur.
- **Dossier de litige auto-constitué** : vidéos des 2 parties (watermarkées), suivi, valeurs, historique, score.
- **Arbitrage** : grille de présomptions, décisions (annuler/capturer caution, refund, sanctions).
- Gestion des **cautions** (préautorisations 100 % valeur), ré-autorisations, captures.
- Suivi des **preuves vidéo** (intégrité, jeton du jour) et purge RGPD (60 j / 1 an si litige).

**Implémentation**
- Machine à états serveur (`server/trade-security/`), timeouts (non-expédition J+3, fenêtre 72 h, ré-auth J+5).
- Stripe Connect (préautorisation `capture_method: manual`).
- Agrégateur transporteurs (statut « livré » déclencheur).
- Stockage vidéo chiffré, URLs signées, accès modération seule.

**Optimisation**
- Console litige avec **lecteur vidéo intégré** + timeline transporteur côte à côte.
- Présomptions appliquées **automatiquement** (l'admin valide/ajuste).
- Voie d'appel pour les montants élevés ; détection de collusion (graphe).

---

## 9. SAV & support (tickets)

**Fonctionnalités**
- **Tickets** : retours produits, problèmes de commande, questions, réclamations.
- Statuts (ouvert / en cours / en attente client / résolu / clos), priorité, SLA.
- Lien direct vers la commande / le membre / le paiement concerné.
- Gestion des **retours produits** : autorisation de retour (RMA), réception, remboursement/échange, réintégration stock.
- Base de réponses (macros) et modèles d'e-mail.

**Implémentation**
- Modèle `Ticket`, `TicketMessage`, `ReturnRequest`. E-mails via Resend (réponses, accusés).
- Attachements (photos produit défectueux).

**Optimisation**
- File SAV priorisée par SLA ; relances auto si attente client trop longue.
- Vue unifiée historique client (toutes ses interactions SAV).
- Indicateurs : délai moyen de résolution, taux de retour par produit (signale un problème qualité).

---

## 10. Catalogue & édition des séries de cartes

**Fonctionnalités**
- Gestion des **saisons** (ex. « Moteur Forgé »), **cartes**, **raretés** (◆◈✦❀✸ + carte unique), **versions** (Standard, Reverse, édition spéciale, alternatives), **langues**.
- **Création d'une nouvelle série** : assistant (métadonnées saison → ajout cartes → raretés/numérotation → versions → visuels HD → langues → publication).
- Édition fiche carte : numéro, marque/modèle, valeur de jeu, pays, puissance/poids, rareté, version, langue, visuels.
- **Import / mise à jour Excel/CSV ou API** : upload, mapping colonnes, prévisualisation, rapport succès/erreurs, **mise à jour sans rupture** des collections existantes.
- Gestion des **visuels haute définition** (upload, zoom, versions d'image).
- Prévisualisation avant publication ; programmation de sortie (date de publication d'une série).

**Implémentation**
- **Payload CMS v3** comme back du catalogue (collections Card/Season/Rarity/Version/Language).
- Import : parser CSV robuste + validation Zod ligne à ligne + dry-run avant commit.
- Médias : stockage objet + variantes d'image (thumbnails, HD).

**Optimisation**
- **Assistant pas-à-pas** pour créer une série (réduit l'erreur).
- Import : **mode simulation** (prévisualise l'impact sans écrire) + diff clair avant validation.
- Versionnage du catalogue (rollback d'un import raté).
- Duplication d'une série comme gabarit pour la suivante.

---

## 11. Marketplace & magasins (supervision, sans paiement)

**Fonctionnalités**
- Vue des magasins membres, annonces « je vends / je cherche », échanges en cours.
- Modération des annonces et prix indicatifs (signalements, retraits).
- Intervention litige (consultation historique horodaté = preuve).
- **Rappel** : aucun paiement ne transite ici (pure mise en relation).

**Implémentation**
- Tables `Shop`, `Listing`, `Trade`. Lecture/modération depuis l'admin.

**Optimisation**
- Détection d'annonces suspectes (prix aberrant, doublons, contournement).
- Liens croisés annonce ↔ membre ↔ signalement.

---

## 12. Gamification

**Fonctionnalités**
- Gestion des **classements** (global, saison, raretés/versions).
- Gestion des **badges** (paliers de rareté, première holo, set Gold, carte unique, première vente/échange) : créer, éditer conditions, activer/désactiver.
- Suivi de l'engagement (qui débloque quoi).

**Implémentation**
- Moteur de règles `Badge`/`BadgeRule` évalué à l'événement (vente, complétion…).
- Classements via vues matérialisées (recalcul périodique).

**Optimisation**
- Éditeur de conditions de badge sans code (admin configure les seuils).
- Aperçu de l'impact d'un nouveau badge avant activation.

---

## 13. Multilingue (FR / 日本語 / EN)

**Fonctionnalités**
- État des traductions par langue (% complété, **chaînes manquantes**).
- Activation/désactivation d'une langue.
- Édition des libellés (interface + contenu catalogue traduit).

**Implémentation**
- Fichiers `messages/{fr,ja,en}` + table de traductions pour le contenu dynamique (cartes).
- Détecteur de clés manquantes au build + rapport admin.

**Optimisation**
- Vue « à traduire » listant les chaînes manquantes par langue.
- Avertissement si une langue est activée alors qu'incomplète.

---

## 14. Notifications & communication

**Fonctionnalités**
- **E-mails transactionnels** (Resend) : validation compte, consentement, commande, expédition, litige, enchère gagnée.
- **Notifications in-app** (Pusher) pour membres et admins.
- Modèles d'e-mails éditables ; journal des envois (délivré/échec).
- Campagnes simples (annonce nouvelle série) — optionnel.

**Implémentation**
- Service `notifications/` centralisant déclencheurs → canaux (e-mail/in-app).
- Templates versionnés ; logs d'envoi.

**Optimisation**
- Préférences de notification par utilisateur et par admin.
- Renvoi en cas d'échec ; aperçu avant envoi.

---

## 15. Rôles, permissions & administrateurs

**Fonctionnalités**
- **Owner** (accès total, gère les admins + réglages sensibles) + sous-rôles : **Modérateur**, **Gestionnaire catalogue**, **Créateur/Boutique (revendeur)**, **Support**.
- Écran **Administrateurs** : inviter, éditer, suspendre, révoquer ; dernière connexion.
- **Matrice de permissions** (rôles × modules/actions, cochable) ; création de sous-rôles personnalisés.
- Indicateur de rôle dans la topbar ; vue restreinte démontrée.

**Implémentation**
- Tables `AdminRole`, `Permission`, `AdminUser`. Vérification **serveur** sur chaque action (pas seulement UI).
- Auth0 pour l'authentification, permissions applicatives en base.

**Optimisation**
- Permissions **masquent** les modules non autorisés (clarté + sécurité).
- Principe du moindre privilège par défaut ; audit de chaque changement de permission.

---

## 16. Conformité, sécurité & journaux

**Fonctionnalités**
- **Journaux de connexion** et logs (obligations hébergeur **LCEN**).
- **RGPD** : demandes d'export / suppression, registre des traitements, gestion du consentement, **politique de purge** (dont vidéos C2C 60 j).
- **Audit log** des actions admin (qui/quoi/quand, avant-après).
- Sécurité applicative : rate-limiting, détection d'anomalies, gestion des sessions admin.
- Protection mineurs : tableau de bord de conformité (vérifications d'âge, consentements parentaux).

**Implémentation**
- `AuditLog` immuable, `DataRequest` (RGPD), rétention configurable par type de données.
- Journaux exportables ; alertes sur événements sensibles (accès massif, suppression).

**Optimisation**
- Tableau de conformité synthétique (ce qui est OK / à traiter).
- Anonymisation/pseudonymisation à la purge plutôt que suppression brutale quand c'est requis.

---

## 17. Réglages plateforme (Owner uniquement)

**Fonctionnalités**
- Paramètres généraux (nom, seuils, devises, langues actives).
- **Intégrations** : Auth0, Stripe (+ Connect), Resend, Pusher, transporteurs, Payload — état + clés.
- Réglages métier : **taux de caution C2C (défaut 100 %)**, seuil parcours renforcé (30 €), délais (72 h, J+3, J+5), purge RGPD (60 j), commissions, frais.
- Pages légales (CGU, CGV, mentions) — édition/versionnage.

**Implémentation**
- Table `Setting` (clé/valeur typée) + garde Owner. Changements audités.

**Optimisation**
- **Tous les seuils paramétrables** sans redéploiement (la logique lit les réglages).
- Historique des changements de réglages (qui a modifié le taux de caution, quand).

---

## 18. Optimisations transverses (synthèse)

- **Performance** : vues matérialisées pour agrégats, pagination serveur + virtualisation, cache court (revalidate/SWR), index Postgres sur les colonnes filtrées.
- **Intuitivité** : ⌘K partout, chiffres cliquables, liens croisés entre entités, files de travail priorisées, breadcrumbs, états vides utiles.
- **Fiabilité** : webhooks idempotents + signés, transactions atomiques (stock, paiements), snapshots financiers historiques.
- **Sécurité** : permission serveur sur chaque action, audit systématique, moindre privilège, rate-limiting.
- **Cohérence visuelle** : design system The Park (carmin = action, or = officiel, néon = statut), admin sobre et dense.
- **Accessibilité** : labels, focus, contrastes, navigation clavier complète.
- **Mobile/tablette** : dégradé responsive propre (l'admin reste desktop-first).

---

## 19. Récap des modules (carte mentale)

```
Dashboard (adaptatif rôle)
├─ Ventes & finances ── CA, marges, charges, TVA, factures, exports, reversements
├─ Stocks ── mouvements, alertes, réservations, valorisation
├─ Paiements ── Stripe, remboursements, chargebacks, payouts, KYC, caution C2C
├─ Enchères ── live, anti-snipe, anti-shill, paiement gagnant, impayés
├─ Utilisateurs ── fiche 360°, sanctions, RGPD, score de risque
├─ Modération ── file mineurs prioritaire, signalements, mots-clés, avis/magasins/enchères
├─ Échanges/Sécurité C2C ── machine à états, preuves vidéo, litiges, cautions
├─ SAV ── tickets, retours (RMA), SLA, macros
├─ Catalogue ── séries, cartes, raretés, versions, langues, import CSV, visuels HD
├─ Marketplace ── supervision magasins/annonces (sans paiement)
├─ Gamification ── classements, badges
├─ Multilingue ── état traductions FR/JA/EN
├─ Notifications ── e-mails Resend, in-app Pusher, templates
├─ Rôles & admins ── Owner + sous-rôles, matrice permissions
├─ Conformité ── RGPD, LCEN, journaux, audit, mineurs
└─ Réglages (Owner) ── intégrations, seuils métier, pages légales
```

---

## 20. Ce que j'ai ajouté (que tu n'avais pas cité) et pourquoi

Pour répondre à ta consigne « il y a des choses que je n'ai pas dites mais tu devrais les trouver » — voici les ajouts déduits de la logique du projet :

- **Rôles & permissions serveur** : indispensable dès qu'il y a plusieurs admins (Owner + sous-rôles).
- **KYC / Stripe Connect** : implicite dès qu'il y a paiement revendeur + reversements + caution.
- **Remboursements, chargebacks, réconciliation** : corollaires obligatoires de tout encaissement.
- **TVA, factures, exports comptables** : Auguste devient vendeur pro → obligations comptables.
- **Snapshots financiers** (coût d'achat figé à la vente) : sinon les marges historiques deviennent fausses.
- **Stock en ledger de mouvements** (pas un compteur) : traçabilité, audit, anti-survente.
- **SAV/retours (RMA)** : une boutique sans gestion de retours est incomplète (droit de rétractation 14 j).
- **Audit log + conformité LCEN/RGPD** : obligations légales + protection en cas de litige.
- **Anti-snipe / anti-shill** sur les enchères : sinon la salle des enchères est manipulable.
- **Files de travail + SLA + attribution** : sans ça, la modération/SAV ne passe pas à l'échelle.
- **Réglages métier paramétrables** (taux caution, seuils, délais) : éviter de redéployer pour un ajustement.
- **Notifications centralisées** : cohérence des e-mails/alertes sur tous les événements.
- **Command palette + chiffres actionnables + liens croisés** : ce qui rend l'admin réellement intuitif.

---

## 21. Auto-vérification & améliorations (2ᵉ passe)

Revue critique du document pour combler les angles morts restants :

1. **Trésorerie / cash-flow** — ajouté implicitement via finances, mais mériterait un **mini-état de trésorerie** (entrées Stripe vs sorties payouts/remboursements/achats stock) pour qu'Auguste pilote son cash, pas seulement son CA.
2. **Dépendance au statut revendeur** — le module finance doit **basculer** selon achat-revente (marge sur coût) ou dépôt-vente (commission + reversement). Prévoir un **réglage de modèle commercial** dans les réglages.
3. **Gestion multi-saisons / archivage** — quand les séries s'accumulent, prévoir l'**archivage** d'une saison (lecture seule) sans casser les collections.
4. **Détection de fraude transverse** — au-delà du C2C : cartes volées (paiement), faux comptes, multi-comptes → un **hub anti-fraude** agrégeant les signaux (Stripe Radar, graphe de comptes, vélocité).
5. **Sauvegarde & reprise** — réglages de backup BDD + export catalogue (continuité de service) : à mentionner côté exploitation.
6. **Tableau de bord par rôle réellement distinct** — ne pas juste masquer : le Modérateur a SON dashboard (files mineurs), le Revendeur a le SIEN (ventes/stock), le Support le sien (SAV). À concevoir comme des accueils dédiés.
7. **Indicateurs de santé plateforme** — uptime, erreurs, webhooks en échec, jobs planifiés (clôtures d'enchères, ré-autorisations) : une page **« Système »** pour l'Owner.
8. **Accessibilité & i18n de l'admin lui-même** — l'admin doit aussi être lisible/navigable au clavier ; libellés centralisés.
9. **Parcours « première fois »** — onboarding admin (créer sa 1ʳᵉ série, configurer Stripe, inviter un modérateur) sous forme de checklist guidée.
10. **Cohérence des seuils** — un seul endroit (Réglages) définit caution 100 %, seuil 30 €, fenêtre 72 h, purge 60 j ; tous les modules lisent ces valeurs (pas de constante codée en dur).

> Ces 10 points sont les améliorations issues de la relecture : ils transforment un back-office « complet » en back-office **pilotable, anti-fraude et exploitable dans la durée**.
