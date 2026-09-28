# Plan de développement de M3ak

Chaque étape doit se terminer par une version testable sur téléphone (Expo Go). Cocher `[x]` quand c'est fait.

## Étape 0 — Fondations
- [ ] Projet Expo + TypeScript + Expo Router, lint, tests
- [ ] Thème M3ak (bleu `#1f5eff`, cyan `#38e1ff`, jaune `#ffd43b`, fond clair `#f4f6fb`), police Cairo, RTL
- [ ] i18n fr / ar
- [ ] Projet Supabase, schéma initial + RLS, données de démo (une agence à Casablanca, ~15 voitures)
- [ ] Authentification (email/téléphone), création d'agence, invitation d'employés, rôles

## Étape 1 — Flotte (MVP gestion)
- [ ] Liste des véhicules avec filtres (disponible, en location, maintenance, à inspecter) — voir `design/02_flotte.png`
- [ ] Fiche véhicule : infos, kilométrage, historique, documents
- [ ] Ajout / modification de véhicule

## Étape 2 — Clients, réservations et locations
- [ ] Clients (CIN, permis, téléphone, documents photo)
- [ ] Calendrier de disponibilité, réservation, départ, retour
- [ ] Contrat PDF, caution (bloquée / retenue / restituée), paiements

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
