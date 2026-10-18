# Plan de développement de M3ak

Chaque étape doit se terminer par une version testable sur téléphone (Expo Go). Cocher `[x]` quand c'est fait.

## Étape 0 — Fondations
- [x] Projet Expo + TypeScript + Expo Router, lint, tests
- [x] Thème M3ak (bleu `#1f5eff`, cyan `#38e1ff`, jaune `#ffd43b`, fond clair `#f4f6fb`), police Cairo, RTL
- [x] i18n fr / ar
- [x] Schéma Supabase + RLS + données de démo prêts (`supabase/`) — reste à créer le projet Supabase et exécuter le SQL (voir `supabase/README.md`)
- [x] Authentification par e-mail, création d'agence et invitation d'employés par code, rôles (owner/manager/employee) — l'authentification par téléphone reste à faire (pas prioritaire pour l'instant)

## Étape 1 — Flotte (MVP gestion)
- [x] Liste des véhicules avec filtres (disponible, en location, maintenance, à inspecter) — voir `design/02_flotte.png`
- [x] Fiche véhicule : infos, kilométrage, historique, documents (historique/documents en placeholder, arrivent aux étapes 2 et 3)
- [x] Ajout / modification de véhicule

## Étape 2 — Clients, réservations et locations
- [x] Clients (CIN, permis, téléphone, documents photo)
- [x] Calendrier de disponibilité, réservation, départ, retour
- [x] Caution (bloquée / partiellement retenue / retenue / restituée), paiements — le **contrat PDF** reste à faire (nécessite les Edge Functions Supabase, prévu comme un pas à part)

## Étape 3 — Inspection par caméra IA ⭐
- [x] Guide de capture par angle (`design/03_inspection_camera.png`), fonctionnement hors ligne
- [x] Inspection de départ et de retour liées à la location
- [ ] Edge Function d'analyse IA → dommages structurés, validation par l'employé (nécessite un compte API Anthropic)
- [ ] Rapport comparatif avant/après (`design/04_rapport_inspection.png`), retenue sur caution, PDF, partage WhatsApp

## Étape 4 — Tableau de bord et maintenance
- [x] Accueil (`design/01_dashboard.png`) : disponibles, en location, en atelier, à inspecter, revenus, taux d'utilisation
- [x] Échéances de maintenance (vidange, assurance, visite technique, freins) — les **notifications push** restent à faire (nécessitent pg_cron + Edge Function, regroupées avec le reste du travail serveur repoussé)

## Étape 5 — Chat M3ak ⭐
- [ ] Écran de chat, Edge Function avec outils sur les données de l'agence
- [ ] Questions types : qui avait la voiture à une date, prochaine vidange, pourquoi une voiture rapporte moins

## Étape 6 — Intelligence et multi-agences
- [x] Accueil par rôle (propriétaire / responsable / employé) avec indicateurs financiers, flotte, activité, performance et recommandations IA (clé de l'entreprise + accord du propriétaire) — voir `docs/ACCUEIL-RAPPORTS.md`
- [ ] Recommandations IA avancées (demande en hausse par période, prévisions)
- [ ] Plusieurs agences physiques, droits par agence

## Étape 7 — Commercialisation
- [ ] Abonnements (Starter 249 / Pro 499 / Business 899 MAD par mois), quotas d'inspections, essai 30 jours
- [ ] Publication App Store / Google Play (EAS), page de présentation

## Évolution — clients, OCR et conducteurs associés
- [x] Création rapide d'un client par scan du permis (lecture Gemini si activée pour l'entreprise, champs douteux signalés, saisie manuelle possible)
- [x] Console web d'administration M3AK (`admin-web/`) : entreprises, clés OCR, utilisation et coût estimé (migrations 0033-0034)
- [x] Lecture automatique des documents par Gemini avec la clé de l'entreprise + accord du propriétaire ; sans clé : fonction non active, saisie manuelle (migration 0032)
- [x] Documents multiples par client (permis, CIN, passeport, justificatif de domicile, autres), correction / remplacement / suppression selon les droits
- [x] Notes internes confidentielles avec auteur, date et historique
- [x] Conducteurs associés à une réservation (recherche d'un client ou conducteur existant, nouveau conducteur, principal distinct du client, sans doublon)
- [x] Vérification avant départ configurable par l'agence, contrôlée côté serveur, avec confirmation humaine
- [x] Traçabilité réservée au propriétaire : qui a fait quoi (locations, paiements, clients, véhicules, contrats, cautions, entretien, inspections, équipe, réglages), filtres période / employé / type, synthèse par personne, export PDF — voir `docs/TRACABILITE.md` (migration 0036)
- [x] Contrat complet bilingue (14 articles, état des lieux, parties) + signature manuscrite du personnel (profil) et du client (après lecture du contrat) collées dans le PDF — voir `docs/CONTRATS-SIGNATURES.md` (migration 0037)
- [x] Modèle de contrat propre à chaque agence, modifiable par le propriétaire (migration 0040)
- [x] Contrat par défaut au format carnet de location (cadres, paiement, km, carburant, état du véhicule, verso) + éditeur de modèle (modifier, supprimer, ajouter des champs et cadres) — migration 0041
- [ ] Faire relire les conditions générales du contrat par un juriste
- [ ] Politique de conservation du journal de traçabilité (durée, purge) — à définir
- [ ] Politique de conservation des documents (durée, purge) — à définir par l'agence
- [ ] Importer un PDF comme document (nécessite `expo-document-picker`) — aujourd'hui : photo ou galerie

