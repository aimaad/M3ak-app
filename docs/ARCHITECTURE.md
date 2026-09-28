# Architecture technique de M3ak

## Stack recommandée
| Besoin | Choix | Pourquoi |
|---|---|---|
| App mobile (iOS + Android) | **Expo (React Native) + TypeScript**, Expo Router | Un seul code pour les deux plateformes, test immédiat sur téléphone avec Expo Go, publication via EAS |
| UI | NativeWind (Tailwind) ou Tamagui, support RTL natif (`I18nManager`) | Rapide à styliser, cohérent avec les maquettes |
| i18n | i18next (fr, ar) | Français + arabe RTL |
| Données serveur | react-query (TanStack Query) | Cache, synchronisation, mode hors ligne |
| Backend | **Supabase** : Postgres, Auth, Storage (photos), Edge Functions, Row Level Security | Tout-en-un, rapide à lancer, sécurisé par agence |
| Stockage local / hors ligne | expo-sqlite ou WatermelonDB + file d'attente de synchronisation | Inspections possibles sans réseau |
| Caméra | expo-camera + expo-image-manipulator | Capture guidée des angles, compression |
| IA inspection | Modèle de vision appelé depuis une Edge Function (Claude avec images, ou modèle spécialisé de détection de dommages) | Comparaison photos départ / retour → liste structurée de dommages |
| IA chat | Claude via Edge Function + outils (tool use) qui interrogent la base de l'agence | Réponses fondées sur les vraies données, sans exposer la base |
| Notifications | expo-notifications + tâches planifiées (pg_cron) | Alertes vidange, assurance, retours… |
| PDF rapport | Génération côté serveur (Edge Function) | Rapport horodaté partageable |
| Partage | Lien WhatsApp (`wa.me`) + lien public signé vers le rapport | Pas besoin d'API WhatsApp payante au début |

## Modèle de données (première version)
- `agencies` (id, nom, ville, plan, …) ; `agency_members` (user_id, agency_id, role: owner | manager | employee)
- `branches` (agences physiques d'une même société)
- `vehicles` (immatriculation, marque, modèle, année, carburant, kilométrage, statut: disponible | en_location | maintenance | a_inspecter, branch_id, prix_jour)
- `customers` (nom, CIN/passeport, permis, téléphone, documents)
- `reservations` / `rentals` (vehicle_id, customer_id, dates prévues et réelles, km départ/retour, carburant, prix, caution, statut)
- `inspections` (rental_id, vehicle_id, type: depart | retour, date, employé, statut) ; `inspection_photos` (angle: avant, arriere, lateral_gauche, lateral_droit, jantes…, url)
- `damages` (inspection_id, zone, type: rayure | choc | jante…, gravité, confiance, nouveau: bool, coût estimé, bbox sur la photo)
- `maintenance_items` (vehicle_id, type: vidange | assurance | visite_technique | freins | pneus, échéance date/km, statut)
- `payments` / `invoices` (rental_id, montant, méthode, statut) ; `deposits` (bloqué, retenu, restitué)
- `chat_messages` (agency_id, user_id, question, réponse, sources)
Toutes les tables portent `agency_id` et sont protégées par des politiques RLS.

## Flux clé : inspection IA
1. Au **départ**, l'employé suit un guide de capture (4 à 8 angles) → photos stockées + dommages existants enregistrés.
2. Au **retour**, même guide de capture, en hors ligne si besoin.
3. Edge Function `analyze-inspection` : envoie les paires de photos (départ/retour, même angle) au modèle de vision, avec une consigne qui demande une sortie JSON stricte (zone, type, gravité, confiance, nouveau/existant).
4. L'app affiche les nouveaux dommages ; l'employé **valide ou corrige** (l'IA assiste, l'humain décide).
5. Calcul de la retenue sur la caution (grille de prix par type/gravité configurable par l'agence) → rapport PDF + envoi WhatsApp.

## Flux clé : chat M3ak
Edge Function `ask-m3ak` : le modèle reçoit la question + des **outils** (`find_rental_by_vehicle_and_date`, `vehicle_history`, `maintenance_due`, `revenue_by_vehicle`…) qui exécutent des requêtes SQL limitées à l'agence de l'utilisateur. Réponse courte, dans la langue de la question, avec les références (location, véhicule).
