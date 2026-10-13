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
- `migrations/0010_fix_role_escalation.sql` — corrige une faille de sécurité : un
  responsable (manager) pouvait s'attribuer le rôle propriétaire (owner), ou l'attribuer
  à un complice, via une invitation ou un ajout de membre avec `role: 'owner'` (voir
  `scripts/rls-security-audit.mjs`)
- `migrations/0011_vehicle_fleet_module.sql` — module complet de gestion du parc :
  catégorie, couleur, transmission, nombre de places, niveau de carburant, tarifs
  semaine/mois, description, photos (galerie), échéances de documents, archivage
  (réservé owner/manager) et nouveaux statuts `en_preparation`/`indisponible`
- `migrations/0012_customers_and_drivers.sql` — module complet de gestion des clients :
  prénom/nom, coordonnées complètes, type particulier/entreprise (raison sociale, ICE),
  langue préférée, notes internes, échéances de documents, archivage (réservé
  owner/manager), et table `drivers` (conducteurs supplémentaires rattachés à un client)
- `migrations/0013_rentals_status_enum.sql` — ajoute les deux nouveaux statuts de
  réservation (en attente de confirmation / confirmée). **À exécuter séparément**
  (clic "Run" à part) de 0014 ci-dessous — voir l'explication dans ce fichier.
- `migrations/0014_rentals_booking_system.sql` — module complet de réservations :
  numéro lisible auto-généré, conducteur principal/lieux/notes, **contrainte
  d'exclusion PostgreSQL** empêchant tout double-chevauchement de réservation même
  en cas de demandes simultanées (`btree_gist`), prix calculé et figé côté serveur
  à partir des tarifs réels du véhicule (jamais depuis une valeur envoyée par le
  client), transitions de statut validées côté serveur, et vérification qu'un
  véhicule/client/conducteur référencé appartient bien à la même entreprise
- `migrations/0015_contracts.sql` — module complet de contrats : référence lisible
  auto-générée, instantané des données au moment de la création (client, véhicule,
  prix, caution — jamais réécrit par une modification ultérieure), cycle de vie
  (préparation → prêt à signer → signé → en cours → clôturé, annulé possible avant
  le départ), signature manuelle documentée (jamais automatique, toujours horodatée
  et attribuée), un seul contrat actif par réservation, et deux fonctions RPC
  (`start_rental_with_contract` / `complete_rental_with_contract`) qui rendent le
  départ et le retour **atomiques** (réservation + véhicule + contrat mis à jour
  ensemble, ou rien du tout) avec protection explicite contre un double départ ou
  un double retour, et sans jamais écraser un véhicule déjà en maintenance
- `migrations/0016_fix_signature_spoofing_and_regressions.sql` — corrige une faille
  trouvée lors de l'audit de stabilisation : un membre pouvait signer un contrat
  "au nom" d'un autre utilisateur réel de l'agence (ex. un employé attribuant la
  signature au propriétaire). `signed_by` doit désormais correspondre à l'auteur
  réel de l'action (voir `scripts/contract-rls-audit.mjs`)
- `migrations/0017_fix_created_by_spoofing_and_error_states.sql` — même famille de
  faille que 0016, mais pour `created_by` : un appel direct à l'API pouvait
  attribuer la création d'une agence, d'une invitation, d'une réservation ou d'un
  contrat à un autre utilisateur réel de l'agence. `created_by` doit désormais
  correspondre à l'auteur réel de l'action (voir `scripts/rental-rls-audit.mjs`
  et `scripts/contract-rls-audit.mjs`)
- `migrations/0018_customer_consent.sql` — ajoute `consentement_donnees` et
  `consentement_date` sur `customers`, pour la gestion du consentement de
  protection des données personnelles
- `migrations/0019_maintenance_enum_values.sql` — ajoute les valeurs `panne`
  (type) et `en_cours` (statut) aux énums de maintenance — **doit être
  exécutée seule, avant 0020** (même raison que 0013 avant 0014 : une valeur
  d'énum ajoutée ne peut pas être utilisée dans la même transaction)
- `migrations/0020_maintenance_repairs.sql` — pannes et réparations : garage,
  coût, pièces remplacées, facture (nouveau bucket `maintenance-documents`),
  et immobilisation automatique du véhicule pendant une intervention
  (`statut` passe à `maintenance` quand une échéance devient `en_cours`, et
  revient à `disponible` à la clôture, uniquement s'il n'y a plus d'autre
  intervention en cours sur ce véhicule — voir
  `scripts/maintenance-rls-audit.mjs`)
- `migrations/0021_branches_team_and_audit_log.sql` — filiales reliées aux
  invitations et aux membres, prénom/nom/photo de profil (chaque membre peut
  modifier sa propre fiche, jamais son rôle ni sa filiale), un manager peut
  désormais retirer un employee (pas un autre manager), filiales réservées à
  owner/manager, nouveau bucket `member-avatars`, et nouveau journal d'audit
  (`agency_audit_log`, visible uniquement par le owner, alimenté uniquement
  par des déclencheurs serveur — voir `scripts/team-rls-audit.mjs`)
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
11. Copiez-collez le contenu de `migrations/0010_fix_role_escalation.sql`, cliquez **Run**.
12. Copiez-collez le contenu de `migrations/0011_vehicle_fleet_module.sql`, cliquez **Run**.
13. Copiez-collez le contenu de `migrations/0012_customers_and_drivers.sql`, cliquez **Run**.
14. Copiez-collez le contenu de `migrations/0013_rentals_status_enum.sql`, cliquez **Run**,
    et **attendez que ça se termine avant de passer à l'étape suivante** (sinon l'étape 15
    échoue avec une erreur Postgres 55P04 — les deux doivent être deux clics "Run" séparés,
    jamais collés puis lancés ensemble).
15. Copiez-collez le contenu de `migrations/0014_rentals_booking_system.sql`, cliquez **Run**.
    (Active l'extension `btree_gist` — standard et déjà disponible sur Supabase, aucune
    configuration supplémentaire n'est nécessaire.)
16. Copiez-collez le contenu de `migrations/0015_contracts.sql`, cliquez **Run**.
17. Copiez-collez le contenu de `migrations/0016_fix_signature_spoofing_and_regressions.sql`,
    cliquez **Run**.
18. Copiez-collez le contenu de `migrations/0017_fix_created_by_spoofing_and_error_states.sql`,
    cliquez **Run**.
19. Copiez-collez le contenu de `migrations/0018_customer_consent.sql`, cliquez **Run**.
20. Copiez-collez le contenu de `migrations/0019_maintenance_enum_values.sql`, cliquez **Run**,
    et **attendez que ça se termine avant de passer à l'étape suivante** (même raison que
    l'étape 14 : les deux ne doivent jamais être collées puis lancées ensemble).
21. Copiez-collez le contenu de `migrations/0020_maintenance_repairs.sql`, cliquez **Run**.
22. Copiez-collez le contenu de `migrations/0021_branches_team_and_audit_log.sql`, cliquez **Run**.
23. (Optionnel mais recommandé pour tester) Copiez-collez `seed.sql`, cliquez **Run**.

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

## Audit de sécurité automatisé (RLS)

`scripts/rls-security-audit.mjs` vérifie par de vrais appels HTTP (comptes et agences
jetables) que les règles de sécurité fonctionnent : isolation entre agences, contrôle des
rôles côté serveur, protection du dernier propriétaire, invitations. À lancer uniquement
contre une instance **locale** (jamais contre le projet de production) :

```bash
npx supabase start   # nécessite Docker Desktop démarré
npx supabase status  # pour récupérer l'URL et les clés locales (ANON_KEY, SERVICE_ROLE_KEY)
SUPA_URL="http://127.0.0.1:54321" SUPA_ANON="<anon key locale>" SUPA_SERVICE="<service_role key locale>" \
  node scripts/rls-security-audit.mjs
```

`scripts/vehicle-rls-audit.mjs` fait la même chose pour le module Flotte : création et
persistance d'un véhicule, immatriculation en double, permissions (employee ne peut pas
archiver), isolation des véhicules et des documents entre deux agences. Même usage, en
remplaçant le nom du script.

`scripts/customer-rls-audit.mjs` fait la même chose pour le module Clients &
Conducteurs : création et persistance d'un client, mise à jour automatique de
`updated_at`, permissions (employee ne peut pas archiver un client ni supprimer un
conducteur ou un document), isolation complète entre deux agences (clients,
conducteurs, documents).

`scripts/rental-rls-audit.mjs` fait la même chose pour le module Réservations : numéro
auto-généré et persistance réelle, prix calculé et figé côté serveur (le client ne
peut pas imposer un montant, un changement de tarif ne modifie pas une réservation
existante), **deux requêtes vraiment simultanées pour le même véhicule — une seule
doit réussir** (test de la protection anti-double-réservation), transitions de statut
invalides rejetées, interdiction de référencer un véhicule/client d'une autre
entreprise, isolation complète entre deux agences.

`scripts/contract-rls-audit.mjs` fait la même chose pour le module Contrats :
instantané figé à la création, un seul contrat actif par réservation, signature
refusée sans preuve même en forçant le statut, saut d'étape refusé même avec une
preuve de signature valide, **départ et retour atomiques** (réservation + véhicule
+ contrat ensemble via RPC), double départ/retour refusé, véhicule déjà en
maintenance jamais écrasé au retour, isolation des contrats et des PDF entre deux
agences.

`scripts/maintenance-rls-audit.mjs` fait la même chose pour le module Maintenance :
permissions (employee ne peut pas supprimer une échéance), isolation entre deux
agences (échéances et factures), **immobilisation automatique du véhicule** quand
une intervention démarre, libération à la clôture uniquement si plus aucune
intervention n'est en cours sur ce véhicule, immobilisation immédiate pour une
panne signalée directement en "en_cours".

`scripts/team-rls-audit.mjs` fait la même chose pour le module Équipe & Filiales :
filiales réservées à owner/manager, une invitation avec filiale affecte bien le
nouveau membre à cette filiale, un manager peut retirer un employee mais jamais un
autre manager ni le owner, chaque membre peut modifier sa propre fiche mais jamais
son rôle ni celui d'un autre membre (même famille que la migration 0010), **journal
d'audit visible uniquement par le owner** (ni un employee, ni le owner d'une autre
agence), isolation des filiales et des avatars entre deux agences.

## Accès par filiale et invitations sécurisées (migrations 0022 à 0026)

À exécuter **dans l'ordre**, une par une, dans le SQL Editor (« Copy raw file » sur GitHub
puis « Run ») :

- `0022_branch_scoped_access.sql` — un membre rattaché à une filiale ne voit que les
  véhicules, locations et données liées de sa filiale ; un membre sans filiale voit tout.
- `0023_member_names_from_signup.sql` — le prénom et le nom saisis à l'inscription sont
  recopiés sur le profil quand on rejoint une agence.
- `0024_strict_branch_isolation.sql` — isolation stricte : rien des autres filiales
  (équipe, invitations, fichiers) ; l'admin (owner) voit toujours tout ; un responsable de
  filiale invite uniquement dans sa filiale.
- `0025_shared_vehicles.sql` — un véhicule sans filiale est partagé par toute l'agence.
- `0026_secure_invitations.sql` — invitations nominatives (prénom, nom, e-mail), code de 12
  caractères généré par le serveur et jamais stocké en clair, lié à l'e-mail exact de la
  personne, à usage unique, valable 7 jours, annulable et renvoyable. **Les anciennes
  invitations par code simple sont annulées** : il faut en recréer.

### Envoi des invitations par e-mail (Gmail)

L'e-mail part depuis la fonction serveur `send-invite` (`supabase/functions/send-invite`).
Sans elle, tout fonctionne quand même : l'invitation est créée et le code est partagé par
WhatsApp ou copié (pas d'e-mail automatique).

1. Dans votre compte Google : activez la validation en deux étapes puis créez un **mot de
   passe d'application** (myaccount.google.com → Sécurité → Mots de passe d'application).
   Le mot de passe de connexion Gmail ne fonctionne pas.
2. Dans Supabase → Edge Functions → Secrets, ajoutez :
   - `SMTP_USER` : votre adresse Gmail d'envoi
   - `SMTP_PASSWORD` : le mot de passe d'application (16 caractères)
   - `SMTP_FROM_NAME` : (optionnel) nom affiché, par exemple `M3ak`
3. Déployez la fonction : `npx supabase functions deploy send-invite` (la connexion
   Supabase CLI du projet est nécessaire), ou créez-la depuis le tableau de bord en collant
   le contenu de `supabase/functions/send-invite/index.ts`.

Ces identifiants ne sont **jamais** dans l'app mobile : ils restent des secrets serveur. La
configuration SMTP de Supabase Auth (e-mails de confirmation) est distincte : la fonction ne
peut pas la réutiliser, d'où ces deux secrets.

## Clients : documents, notes internes, conducteurs et vérification avant départ (migrations 0028 et 0029)

À exécuter dans l'ordre, une par une, après 0027 :

- `0028_customer_documents_and_notes.sql` — **documents clients multiples** (table
  `customer_documents` : plusieurs documents par type, libellé libre, autorité, catégories de
  permis, notes, auteur et date imposés par le serveur, suppression douce réservée aux
  responsables) ; les documents existants (ancien champ JSON) sont **recopiés**, l'ancien champ
  est conservé tel quel. **Notes internes** (`customer_notes` + historique des versions) :
  l'ancienne note libre devient la première note. Colonne `agencies.customer_ocr_enabled`
  (scan des permis **désactivé par défaut**).
- `0029_drivers_and_departure_checks.sql` — conducteur = fiche client existante
  (`drivers.linked_customer_id`, sans doublon), règles des conducteurs d'une réservation
  (pas de doublon, maximum configurable, verrouillé une fois la location commencée, écriture
  atomique `set_rental_drivers`), **politique de départ** de l'agence
  (`agency_departure_policies`, inactive par défaut), liste de contrôle
  `rental_departure_check`, confirmation humaine horodatée, et contrôle serveur dans
  `start_rental_with_contract`. Ajoute `contracts.autres_conducteurs`.

### Scan automatique du permis (fonction `scan-customer-document`)

1. Le propriétaire active l'option dans l'app : **Mon entreprise → Scan automatique des
   permis**. Tant qu'elle est désactivée, la fonction refuse (`ocr_disabled`) : la photo
   d'un permis contient des données personnelles envoyées à un fournisseur d'IA externe.
2. Le fournisseur est celui du scan de carte grise : secret `GEMINI_API_KEY` (gratuit) ou
   `ANTHROPIC_API_KEY` (payant). Sans clé, la fonction répond `ocr_not_configured`.
3. Déployez avec la CLI (la fonction partage du code avec `supabase/functions/_shared`, ce
   que le collage dans l'éditeur du tableau de bord ne gère pas) :
   `npx supabase functions deploy scan-customer-document`

Seule l'image est envoyée au fournisseur (aucun nom d'agence, d'utilisateur ou de client) ;
la fonction ne stocke ni ne journalise l'image ni les valeurs lues, et revalide chaque champ
(format des dates, longueurs). Un champ illisible reste vide : jamais de valeur inventée.

### Exigences avant départ

**Mon entreprise → Exigences avant départ** (propriétaire) : permis par conducteur, permis
valide jusqu'au retour, CIN/passeport du client, confirmation humaine, rôle autorisé à
confirmer, nombre maximum de conducteurs supplémentaires. Ce sont des modèles d'exigences
**métier à faire valider**, pas des règles juridiques ; tant que « Bloquer le départ » est
désactivé, la liste de contrôle s'affiche sans rien empêcher.

### Tests SQL reproductibles (sans Supabase)

`supabase/tests/run-local.sh` crée des bases PostgreSQL de test vierges, rejoue **toutes** les
migrations, puis exécute les scénarios `supabase/tests/*.test.sql` (permissions, isolation
entre agences, notes, documents, conducteurs, départ, invitations, accès par filiale). Il
nécessite un PostgreSQL local (extensions `btree_gist` et `pgcrypto`) et ne doit jamais être
lancé contre un vrai projet.

Un échec affiche la ligne RLS/politique concernée ; corrigez-la puis relancez le script
avant de reporter la correction sur le projet de production (via le SQL Editor, comme à
l'étape 2).

## Création rapide de véhicule et scan de carte grise (migration 0027)

- `0027_vehicle_vin_and_finition.sql` — ajoute `vin` et `finition` sur `vehicles`, avec un
  `vin` unique par agence quand renseigné (plusieurs véhicules sans VIN restent possibles).
  À exécuter dans le SQL Editor comme les précédentes.

`scripts/vehicle-rls-audit.mjs` a été complété avec le contrôle du VIN en double (refusé
dans la même agence, autorisé si aucun VIN n'est renseigné sur plusieurs véhicules).

### Scan automatique de la carte grise par IA (optionnel)

L'écran « Ajouter un véhicule » propose de scanner la carte grise pour préremplir le
formulaire. Cette lecture passe par la fonction serveur `scan-vehicle-document`
(`supabase/functions/scan-vehicle-document`), qui appelle l'API Anthropic (Claude) côté
serveur — la clé n'est **jamais** dans l'app mobile.

Sans cette fonction déployée ou sans clé configurée, tout fonctionne quand même : l'écran
l'indique clairement et renvoie vers la saisie par plaque/VIN ou la saisie manuelle.

1. **Gratuit (recommandé)** : créez une clé sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   (offre gratuite Google Gemini, avec des limites de débit et de volume par jour).
   Dans Supabase → Edge Functions → Secrets, ajoutez `GEMINI_API_KEY` avec cette clé.
   Optionnel : `GEMINI_MODEL` pour changer de modèle (par défaut `gemini-2.5-flash`).
   *Confidentialité* : sur l'offre gratuite, Google peut utiliser les images envoyées pour
   améliorer ses produits, et des personnes peuvent les relire. Une carte grise contient
   le nom et l'adresse du titulaire : à réserver aux véhicules de l'agence. Activer la
   facturation côté Google (usage quasi nul) retire cette réserve.
2. *Payant (alternative)* : une clé Anthropic dans le secret `ANTHROPIC_API_KEY`
   ([console.anthropic.com](https://console.anthropic.com), quelques centimes par scan). Elle
   n'est utilisée que si `GEMINI_API_KEY` est absent.
3. Déployez la fonction : `npx supabase functions deploy scan-vehicle-document`, ou
   créez-la depuis le tableau de bord en collant le contenu de
   `supabase/functions/scan-vehicle-document/index.ts`.

La photo de la carte grise n'est jamais stockée par cette fonction : elle est envoyée à
au fournisseur d'IA pour extraction puis oubliée. Si l'employé choisit de la garder comme
document du véhicule, elle est envoyée séparément vers le bucket `vehicle-documents`,
comme n'importe quel autre document.
