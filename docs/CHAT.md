# Chat M3ak

L'employé pose une question en français, en arabe ou en darija ; M3ak répond **à partir des données de l'agence**.

## Exemples
- « Qui avait la Logan la semaine dernière ? »
- « Quelles voitures reviennent cette semaine ? » / « Qui doit rendre une voiture demain ? »
- « Quelles voitures sont disponibles ce week-end ? »
- « Qui avait la voiture quand ce dommage est apparu ? » (inspection de retour où le dommage est nouveau → location et client concernés, avec prudence)
- « شكون كرا هاد الطوموبيل ملي وقع هاد الضرر؟ »

## Comment ça marche
1. L'app appelle la fonction serveur `chat-m3ak` (jamais de clé dans l'app).
2. La fonction envoie la question à Gemini (clé de **l'entreprise**) avec la date du jour (heure du Maroc) et la liste des **outils** autorisés.
3. Gemini ne lit jamais la base : il demande un outil à la fois (`rentals`, `returns_due`, `departures_due`, `available_vehicles`, `vehicle_damages`, `vehicle_maintenance`, `customer_history`, `customers`, `fleet`, `finance`, `fleet_alerts`, `fleet_stats`, `activity`, `contracts`, 3 tours de recherche par question, 3 recherches par tour). Chaque outil est une fonction SQL **en lecture seule** exécutée avec les **droits de l'utilisateur** : un employé de filiale ne voit que sa filiale, une autre entreprise ne voit rien (RLS, testé dans `supabase/tests/chat.test.sql`).
4. Gemini écrit la réponse à partir des résultats. Les **sources** (locations) affichées sont limitées à celles réellement vues dans les résultats : l'IA ne peut pas citer un lien inventé.

## Règles
- **Accord du propriétaire** obligatoire (Mon entreprise → Chat M3ak), éteint par défaut, impossible sans clé Gemini configurée par M3AK.
- Ouvert à **tout le personnel** (employés, gérants, propriétaire).
- Ce qui part vers l'IA : noms et téléphones des clients concernés par la question, voitures, dates, montants. **Jamais** le CIN, le numéro de permis ni les photos.
- Lecture seule : le chat ne crée ni ne modifie rien.
- Les résultats des outils sont traités comme des **données**, pas des instructions (protection contre les textes piégés dans une note ou un nom).
- Limite : 300 questions par entreprise et par 24 h (suivi d'utilisation par compteurs, jamais le texte ; visible dans la console web comme « chat_calls »).
- **Historique par utilisateur** (tables `chat_conversations` / `chat_convo_messages`) : personne d'autre ne le voit, pas même le propriétaire ; effacé après 90 jours (pg_cron, 3 h du matin). Une conversation peut être supprimée par son auteur.

## Mise en route
1. Exécuter `supabase/migrations/0054_chat.sql`.
2. `npx supabase functions deploy chat-m3ak --project-ref <ref>` (la fonction partage `_shared/gemini.ts`).
3. Le propriétaire active le chat dans **Mon entreprise**.
4. Tests : `supabase/tests/chat.test.sql` (SQL), `src/features/chat/__tests__` (Jest).

## Limites connues
- **Non vérifié avec une vraie clé Gemini** : justesse des réponses, qualité en darija, choix des bons outils par l'IA.
- « Qui a fait ce dommage ? » est un **indice** (qui avait la voiture à l'inspection de retour), pas une preuve : sans inspection de départ, le chat le signale.
- Pas encore de questions sur les paiements en détail ni sur les statistiques de revenus (outils à ajouter).
- L'ancienne table `chat_messages` (migration 0001) n'est pas utilisée ; le chat utilise `chat_convo_messages`.

## Outils ajoutés (migrations 0058 et 0059)
- `customers` / `fleet` : nombre et liste des clients / voitures (jamais de CIN ni de permis).
- `finance` : encaissé, en attente, impayés, cautions — **propriétaire seulement** (`{"error":"owner_only"}` sinon).
- `fleet_alerts` : assurances, visites techniques et entretiens à échéance pour toute la flotte.
- `fleet_stats` : voitures les plus/moins louées, taux d'utilisation, tendance de la demande (chiffre d'affaires par voiture : propriétaire seulement).
- `activity` : équipe et journal d'activité — propriétaire seulement (RLS du journal), sans le contenu des détails.
- `contracts` : contrats et statut signé / non signé (sans CIN ni chemin de signature).
Tests : `supabase/tests/chat-more-tools.test.sql`. Après l'expiration de l'essai (migration 0057), tous ces outils ne renvoient plus rien.
