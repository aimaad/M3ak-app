# Base de données Supabase — M3ak

Ce dossier contient le schéma SQL complet de l'Étape 0 : toutes les tables décrites
dans `docs/ARCHITECTURE.md`, protégées par Row Level Security (RLS) pour que chaque
agence ne voie **que ses propres données**.

- `migrations/0001_init_schema.sql` — tables, types, index
- `migrations/0002_rls_policies.sql` — activation RLS + règles de sécurité par agence
- `migrations/0003_client_documents_storage.sql` — bucket de stockage pour les photos
  de documents clients (CIN, permis), protégé par agence
- `migrations/0004_inspection_photos_storage.sql` — bucket de stockage pour les photos
  d'inspection (départ/retour), protégé par agence
- `migrations/0005_inspection_photos_unique_angle.sql` — une seule photo par angle et
  par inspection (une reprise remplace la précédente)
- `migrations/0006_agency_invites.sql` — invitations d'employés par code (table +
  fonction `redeem_invite`)
- `migrations/0007_agencies_created_by.sql` — colonne `created_by` sur `agencies` +
  correction de la règle de sécurité qui empêchait la création d'une agence
- `migrations/0008_vehicle_documents.sql` — colonne `documents` (carte grise, assurance,
  visite technique) sur `vehicles` + bucket de stockage associé
- `migrations/0009_agency_details_and_member_safety.sql` — informations complètes de
  l'agence (raison sociale, e-mail, téléphone, adresse, logo…), protection contre la
  suppression du dernier propriétaire, et bucket de stockage pour le logo
- `seed.sql` — données de démo : une agence "M3ak Demo — Casablanca" avec 15 véhicules,
  3 clients et quelques échéances de maintenance

## 1. Créer le compte et le projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte gratuit (avec votre email).
2. Cliquez sur **New project** :
   - Nom : `m3ak` (ou ce que vous voulez)
   - Mot de passe de la base de données : choisissez-en un solide et **gardez-le en lieu sûr**
   - Région : Europe (la plus proche du Maroc, ex. `eu-west` / `eu-central`)
3. Attendez ~2 minutes que le projet soit prêt.

## 2. Exécuter le schéma (le plus simple : sans rien installer)

1. Dans le dashboard Supabase, ouvrez **SQL Editor** (menu de gauche).
2. Copiez-collez le contenu de `migrations/0001_init_schema.sql`, cliquez **Run**.
   (Un message vous demandera si vous voulez activer RLS tout de suite — choisissez
   **"Run without RLS"**, c'est le fichier suivant qui s'en charge.)
3. Copiez-collez le contenu de `migrations/0002_rls_policies.sql`, cliquez **Run**.
4. Copiez-collez le contenu de `migrations/0003_client_documents_storage.sql`, cliquez **Run**.
5. Copiez-collez le contenu de `migrations/0004_inspection_photos_storage.sql`, cliquez **Run**.
6. Copiez-collez le contenu de `migrations/0005_inspection_photos_unique_angle.sql`, cliquez **Run**.
7. Copiez-collez le contenu de `migrations/0006_agency_invites.sql`, cliquez **Run**.
8. Copiez-collez le contenu de `migrations/0007_agencies_created_by.sql`, cliquez **Run**.
9. Copiez-collez le contenu de `migrations/0008_vehicle_documents.sql`, cliquez **Run**.
10. Copiez-collez le contenu de `migrations/0009_agency_details_and_member_safety.sql`,
    cliquez **Run**.
11. (Optionnel mais recommandé pour tester) Copiez-collez `seed.sql`, cliquez **Run**.

Vous devriez voir les tables apparaître dans **Table Editor**.

## 3. Récupérer les clés pour l'app

Dans **Project Settings → API** (onglet **Data API** pour l'URL, onglet **API Keys** pour
la clé — ou l'onglet **"Legacy anon, service_role API keys"** si Supabase vous propose les
nouvelles clés "Publishable/Secret") :
- `Project URL` → à mettre dans `.env` sous `EXPO_PUBLIC_SUPABASE_URL`
  (l'URL de base uniquement, ex. `https://xxxxxxxxxxxx.supabase.co` — **sans** `/rest/v1/`
  ni aucun chemin à la fin)
- clé `anon` `public` (ou **"Publishable key"**, les deux fonctionnent) → à mettre dans
  `.env` sous `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Ne copiez **jamais** la clé `service_role` dans l'app mobile : elle donne un accès total
à la base et doit rester uniquement dans les Edge Functions côté serveur.

## 4. Créer votre compte

Depuis l'app, écran de connexion → **"Pas de compte ? Créer un compte"** → e-mail +
mot de passe. Si la confirmation par e-mail est activée sur votre projet Supabase
(**Authentication → Providers → Email**), vous recevrez un e-mail à confirmer avant de
pouvoir vous connecter ; sinon vous êtes connecté immédiatement.

Une fois connecté sans agence, l'app propose de **créer votre propre agence** ou de la
**rejoindre avec un code d'invitation** (généré par un propriétaire/responsable depuis
l'écran "Équipe" de l'app). Tout se passe dans l'app, plus besoin de SQL pour ça.

### Alternative : relier votre compte à l'agence de démo (pour tester avec les données déjà créées)

Si vous voulez voir les 15 véhicules de démo plutôt que de créer une agence vide,
reliez votre compte à l'agence de démo manuellement. Dans le **SQL Editor** (il exécute
vos requêtes en tant qu'administrateur, pas en tant que l'utilisateur connecté —
`auth.uid()` n'y fonctionne donc pas ; on sélectionne l'utilisateur par e-mail) :

```sql
insert into public.agency_members (agency_id, user_id, role, nom_complet)
select
  '11111111-1111-1111-1111-111111111111',
  id,
  'owner',
  'Votre nom'
from auth.users
where email = 'votre-email@exemple.com';  -- remplacez par le vôtre
```

## Alternative : Supabase CLI (optionnel, pour les développeurs)

Si vous préférez tout piloter en ligne de commande :

```bash
npx supabase login
npx supabase link --project-ref <votre-project-ref>
npx supabase db push
```

`db push` applique les fichiers de `migrations/` dans l'ordre. `seed.sql` n'est utilisé
automatiquement que par `supabase db reset` (base locale) ; sur un projet distant,
exécutez-le manuellement via le SQL Editor comme à l'étape 2.
