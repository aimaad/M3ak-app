# Console d'administration M3AK (web)

Page web **réservée à l'administrateur de la plateforme** (vous, l'opérateur M3AK). Elle permet de :
- voir **toutes les entreprises** créées (nom, ville, date de création, nombre de membres) ;
- **configurer, modifier ou retirer la clé d'API Gemini** de chaque entreprise (écriture seule : la clé ne peut plus être relue) ;
- voir pour chaque entreprise l'**utilisation de l'IA** : documents lus, échecs, **rapports IA** de l'accueil (recommandations), tokens, dernière analyse sur le mois, 30 jours ou depuis le début ;
- voir le **coût estimé** en USD et en MAD, à partir du tarif Google que vous saisissez.

Elle ne donne **aucun accès** aux clients, véhicules ou locations des entreprises.

## Mise en route (une seule fois)

1. **Base de données** — dans Supabase → SQL Editor, exécutez (si ce n'est pas déjà fait) les migrations
   `0032_agency_ocr_settings.sql`, `0033_platform_admin_ocr_keys.sql`, `0034_ocr_usage_and_web_admin.sql` puis `0035_ai_insights.sql`
   (« Copy raw file » pour éviter les troncatures ; **jamais** les fichiers de tests SQL).
2. **Vous déclarer administrateur** (SQL Editor, avec l'e-mail de votre compte M3AK) :
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where email = 'VOTRE_EMAIL';
   ```
3. **Déployer les fonctions** : `npx supabase functions deploy scan-document` et `npx supabase functions deploy generate-insights` (la seconde produit les recommandations de l'accueil).
4. **Configurer la console** : copiez `config.example.js` en `config.js`, puis renseignez l'URL de votre projet
   et la clé « anon » (Supabase → Project Settings → API). Jamais la clé « service_role ».
5. **Lancer** (depuis le dossier du projet) :
   ```
   cd admin-web
   npx serve .
   ```
   puis ouvrez l'adresse affichée (par ex. http://localhost:3000) et connectez-vous avec votre compte M3AK.
   (Ouvrir `index.html` directement en double-clic ne fonctionne pas : le navigateur bloque les modules hors serveur.)

## Mot de passe oublié
La page de connexion propose « Mot de passe oublié ? » : e-mail → code reçu par e-mail → nouveau mot de passe
(8 caractères minimum). Elle suppose que le modèle d'e-mail « Reset Password » de Supabase affiche le code
`{{ .Token }}` (voir `supabase/README.md`, section « Mot de passe oublié »).

## Mettre la console en ligne (gratuit)
C'est un site statique : déposez le dossier `admin-web` (avec votre `config.js`) sur Cloudflare Pages, Netlify
ou GitHub Pages. Seule la page de connexion est publique ; tout le reste est protégé côté serveur par la table
`platform_admins`. Pour renforcer : activez l'authentification à deux facteurs sur votre compte, et restreignez
l'accès par adresse IP si votre hébergeur le permet.

## Comment sont comptés l'usage et le coût
- Chaque analyse envoyée à Gemini inscrit **une ligne de compteurs** (entreprise, type de document, succès/échec,
  nombre de tokens). **Jamais** l'image, ni les valeurs lues, ni la clé.
- Il n'y a plus d'OCR sur le téléphone : sans clé configurée (ou sans accord du propriétaire), la lecture automatique
  est « non active » pour l'entreprise et ses employés saisissent à la main.
- **Clé gratuite** : coût estimé 0. **Clé payante** : tokens × tarif que vous saisissez (par million de tokens,
  entrée et sortie). L'application ne connaît pas le tarif Google et n'en suppose aucun : tant que vous ne l'avez
  pas saisi, l'écran affiche « Tarif non configuré ».
- Ce sont des **estimations**. La facture réelle est celle de Google : vérifiez-la avant toute refacturation.
