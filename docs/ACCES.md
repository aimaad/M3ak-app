# Création d'agences et durée d'accès (migration 0057)

## Qui peut créer une agence ?
Uniquement l'administrateur plateforme, depuis la **console web** (`admin-web`, section « Créer l'agence d'un client »).
L'app n'a plus d'écran de création : un nouvel inscrit voit seulement « Rejoindre avec un code ».

Déroulé : la console appelle `admin_create_agency` → l'agence est créée avec un essai de N jours + un **code propriétaire**
(valable 30 jours, lié à l'e-mail du client). Le client crée son compte avec cet e-mail, le confirme, puis saisit le code.

## Essai et blocage
- `agencies.access_until` (vide = illimité) et `agencies.suspended`.
- `agency_has_access()` est vérifiée par `is_agency_member`, `agency_role_of`, `is_agency_wide`, `can_access_branches` :
  quand l'accès est fermé, **la RLS refuse toutes les données de l'agence** (même hors de l'app). Notifications et invitations aussi.
- Le propriétaire ne peut pas modifier ces deux colonnes (trigger `protect_agency_access_columns`).
- L'app lit `my_agency_access()` (toutes les 5 min) et affiche `/acces-bloque` ; un bandeau « Période d'essai » s'affiche sur l'accueil.
- Les données ne sont pas supprimées : prolonger l'accès (console : +5 j, +30 j, Illimité, Réactiver) les rend aussitôt.
- Les agences créées avant 0057 restent illimitées.

Tests : `supabase/tests/agency-access.test.sql`, `src/features/agency/__tests__/access.test.ts`, `admin-web/__tests__`.
