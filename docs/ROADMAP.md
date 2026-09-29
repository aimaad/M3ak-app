# Plan de développement de M3ak

Chaque étape doit se terminer par une version testable sur téléphone (Expo Go). Cocher `[x]` quand c'est fait.

## Étape 0 — Fondations
- [x] Projet Expo + TypeScript + Expo Router, lint, tests
- [x] Thème M3ak (bleu `#1f5eff`, cyan `#38e1ff`, jaune `#ffd43b`, fond clair `#f4f6fb`), police Cairo, RTL
- [x] i18n fr / ar
- [x] Schéma Supabase + RLS + données de démo prêts (`supabase/`) — reste à créer le projet Supabase et exécuter le SQL (voir `supabase/README.md`)
- [ ] Authentification (email/téléphone), création d'agence, invitation d'employés, rôles — connexion par e-mail faite (`login.tsx`) ; téléphone, création d'agence dans l'app et invitations restent à faire

## Étape 1 — Flotte (MVP gestion)
- [x] Liste des véhicules avec filtres (disponible, en location, maintenance, à inspecter) — voir `design/02_flotte.png`
- [x] Fiche véhicule : infos, kilométrage, historique, documents (historique/documents en placeholder, arrivent aux étapes 2 et 3)
- [x] Ajout / modification de véhicule

## Étape 2 — Clients, réservations et locations
- [x] Clients (CIN, permis, téléphone, documents photo)
- [x] Calendrier de disponibilité, réservation, départ, retour
- [x] Caution (bloquée / partiellement retenue / retenue / restituée), paiements — le **contrat PDF** reste à faire (nécessite les Edge Functions Supabase, prévu comme un pas à part)

## Étape 3 — Inspection par caméra IA ⭐
- [ ] Guide de capture par angle (`design/03_inspection_camera.png`), fonctionnement hors ligne
- [ ] Inspection de départ et de retour liées à la location
- [ ] Edge Function d'analyse IA → dommages structurés, validation par l'employé
- [ ] Rapport comparatif avant/après (`design/04_rapport_inspection.png`), retenue sur caution, PDF, partage WhatsApp

## Étape 4 — Tableau de bord et maintenance
- [ ] Accueil (`design/01_dashboard.png`) : disponibles, en location, en atelier, à inspecter, revenus, taux d'utilisation
- [ ] Échéances de maintenance (vidange, assurance, visite technique, freins) + notifications push

## Étape 5 — Chat M3ak ⭐
- [ ] Écran de chat, Edge Function avec outils sur les données de l'agence
- [ ] Questions types : qui avait la voiture à une date, prochaine vidange, pourquoi une voiture rapporte moins

## Étape 6 — Intelligence et multi-agences
- [ ] Recommandations (demande en hausse, véhicules sous-utilisés, rentabilité par voiture)
- [ ] Plusieurs agences physiques, droits par agence

## Étape 7 — Commercialisation
- [ ] Abonnements (Starter 249 / Pro 499 / Business 899 MAD par mois), quotas d'inspections, essai 30 jours
- [ ] Publication App Store / Google Play (EAS), page de présentation
