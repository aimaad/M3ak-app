# Notifications M3ak

## Ce que voit l'utilisateur
- **Cloche** sur l'accueil (compteur ; rouge s'il y a une urgence) → page **Notifications**.
- Chaque notification : icône par catégorie, couleur selon l'urgence (violet = information, orange = à surveiller, rouge = urgent), texte clair, **nom de la filiale** si l'agence en a, ancienneté, et un bouton **Appeler** quand elle contient le numéro d'un client.
- Toucher une notification l'ouvre (location, contrat, véhicule…) **et la fait disparaître de la liste**. La croix la supprime sans l'ouvrir. « Tout supprimer » vide la liste.
- Supprimer ne concerne **que soi** : chaque destinataire a sa propre ligne (table `notifications`, une ligne par personne).
- **Profil → Notifications** : interrupteur général, interrupteur « sur ce téléphone » (push) et un interrupteur par catégorie (locations, rappels, paiements, contrats, inspections, maintenance, équipe, clients).

## Qui reçoit quoi (règle unique, côté serveur : `notify_agency`)
| Destinataire | Reçoit |
|---|---|
| Propriétaire | tout, dans toutes les filiales (la filiale est indiquée si l'agence en a) |
| Gérant / employé sans filiale | tout ce qui concerne l'agence |
| Gérant / employé d'une filiale | ce qui concerne sa filiale |
| L'auteur de l'action | rien pour sa propre action |
| Quelqu'un qui a coupé les notifications ou une catégorie | rien de ce qu'il a coupé |

Événements équipe / inspection ignorée : gérants et propriétaire seulement.

## Événements
**Instantanés** (déclencheurs) : location créée / confirmée / démarrée / rendue / annulée / prolongée, paiement reçu, retenue sur caution, contrat signé, inspection analysée (dommages détectés), inspection ignorée, véhicule en maintenance, nouveau membre, nouveau client.

**Rappels** (`generate_scheduled_notifications`, toutes les heures entre 7 h et 21 h, heure du Maroc, une seule fois par événement) : retour prévu demain / aujourd'hui (avec nom et numéro du client), retour en retard (chaque jour), départ prévu aujourd'hui / demain, client en retard au départ, entretien à prévoir (7 jours) ou en retard, permis du client qui expire dans 14 jours alors qu'une location est en cours ou à venir.

Le ménage est fait automatiquement : notifications masquées depuis 30 jours ou vieilles de 90 jours effacées.

## Mise en route
1. **Base** : exécuter `supabase/migrations/0053_notifications.sql` (Supabase → SQL Editor). Les rappels demandent l'extension **pg_cron** : Database → Extensions → activer `pg_cron`, puis rejouer la migration (elle programme la tâche `m3ak_notifications`, toutes les heures). Vérifier : `select * from cron.job;`.
2. **Dans l'application** (Expo Go suffit) : la cloche, la page et les réglages fonctionnent tout de suite.
3. **Notifications sur le téléphone (push)** — demandent l'application installée (Expo Go ne reçoit plus de push) :
   1. Sur ton PC : `npm install -g eas-cli`, `eas login`, puis dans le dossier du projet `eas init` (crée le `projectId`).
   2. `eas build --profile development --platform ios` (ou android). Pour iOS il faut un compte Apple Developer ; installer le build sur le téléphone, puis `npx expo start --dev-client`.
   3. Déployer la fonction : `npx supabase functions deploy send-push --project-ref <ref> --no-verify-jwt`
   4. Définir le secret : `npx supabase secrets set PUSH_WEBHOOK_SECRET=<une longue valeur aléatoire> --project-ref <ref>`
   5. Supabase → Database → **Webhooks** → Create : table `notifications`, évènement **Insert**, type *Supabase Edge Functions* → `send-push`, méthode POST, ajouter l'en-tête HTTP `x-webhook-secret` = la même valeur.
   6. Tester : créer une location avec un compte, un autre compte (ou le propriétaire) reçoit une notification sur son téléphone.

## Sécurité et vie privée
- Un utilisateur ne lit et ne masque que **ses** notifications (RLS) ; il ne peut ni en créer, ni modifier leur contenu, ni les effacer côté serveur.
- Le numéro de téléphone d'un client n'est dans une notification que pour les personnes qui ont déjà accès à cette location.
- La fonction `send-push` refuse tout appel sans le secret du webhook ; les jetons des téléphones ne sont lisibles que par le serveur et leur propriétaire.
- Un échec d'écriture d'une notification ne bloque jamais l'opération métier (avertissement serveur seulement).
- Les textes des push sont écrits côté serveur dans la langue du destinataire (`supabase/functions/send-push/texts.ts`) ; ceux de l'application sont dans `src/i18n` (clés `notifications.*`). Un test vérifie que chaque type existe en français et en arabe.

## Limites connues
- Pas de push sous Expo Go ni sur simulateur.
- Les rappels « demain / aujourd'hui » sont calculés à l'heure du Maroc, une fois par jour et par location.
- Pas encore de notification pour un solde impayé ni pour la « demande en hausse » (alertes intelligentes de la phase 6).
