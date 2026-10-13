# OCR confidentiel — permis de conduire et cartes grises

Ce document décrit ce qui est **réellement** implémenté. Les points non vérifiés sont signalés
`NOT VERIFIED` : ne pas les présenter comme garantis.

## 1. Où s'exécute l'OCR

Sur le **téléphone de l'employé**, via la bibliothèque **`expo-text-extractor`** (licence MIT, gratuite) :

| Plateforme | Moteur utilisé par la bibliothèque | Remarque |
|---|---|---|
| Android | Google ML Kit « Text Recognition » (`play-services-mlkit-text-recognition`) | Reconnaissance sur l'appareil. Le *modèle* de reconnaissance est fourni par Google Play Services et peut être téléchargé au premier usage ; aucune image n'est envoyée lors de ce téléchargement. |
| iOS | Apple Vision (`VNRecognizeTextRequest`) | Intégré au système, aucune connexion. |

Le code natif de la bibliothèque a été relu : il ne contient aucun appel réseau (il lit le fichier
image local, appelle ML Kit / Vision, renvoie la liste des textes).

Le texte reconnu est ensuite interprété **par du code M3AK** (`src/features/ocr/*-parser.ts`) :
règles sur les étiquettes (« Nom », « 4a », « Marque »…), formats de dates, plaque marocaine
`8921 | ب | 14`, VIN de 17 caractères, catégories de permis. Un champ non trouvé reste **vide** ;
rien n'est deviné. Les champs peu certains sont marqués « à vérifier ».

Limites connues : le moteur latin lit mal l'arabe (la lettre arabe de la plaque peut manquer →
l'employé la saisit) ; une photo floue ou de travers donne moins de champs ; un permis étranger
à mise en page différente donnera moins de champs. Dans tous les cas l'employé vérifie et corrige.

## 2. Qui reçoit les images

- **Par défaut : personne.** La lecture se fait sur le téléphone ; aucune image ni aucun texte lu n'est
  envoyé à un service d'analyse.
- **Option par entreprise : Google Gemini, avec la clé d'API de l'entreprise** (migration `0032`, fonction
  `scan-document`). Une image n'est envoyée à Google que si **les trois conditions** sont vraies :
  1. l'opérateur M3AK a enregistré une clé Gemini pour cette entreprise (table `agency_ocr_settings`, jamais
     lisible depuis l'app : aucune policy, droits retirés à `anon` / `authenticated`) ;
  2. le **propriétaire** de l'entreprise a donné son accord dans « Mon entreprise » (refusé côté serveur tant
     qu'il n'y a pas de clé, et pour tout autre rôle) ;
  3. l'utilisateur est authentifié et membre de cette entreprise.
  Pas de clé globale, pas de secours vers un autre fournisseur. Si l'analyse cloud échoue, l'app **retombe sur
  la lecture locale**, jamais sur un autre service. L'écran de scan affiche alors un message qui dit
  explicitement que la photo est envoyée à Google.
- **Clé gratuite vs payante :** avec une clé de l'offre gratuite de Google, Google peut utiliser les images
  envoyées. Pour des données confidentielles en production, l'entreprise doit utiliser une clé dont la
  facturation est activée. L'app ne peut pas détecter l'offre de la clé : l'avertissement est affiché au
  propriétaire à l'activation, et la responsabilité du choix de la clé revient à l'opérateur et à l'entreprise.
- **Conservation (optionnelle)** : seulement si l'employé laisse cochée « Enregistrer la photo dans
  le dossier », l'image est envoyée au **backend M3AK (Supabase)**, dans un bucket privé
  (`client-documents` pour les permis, `vehicle-documents` pour les cartes grises). Décochée, la
  photo reste sur l'appareil et n'est pas téléversée.
- Autres flux sortants de l'app (inchangés, sans lien avec l'OCR) : Supabase (base, auth, stockage),
  fonction `send-invite` (e-mail d'invitation via SMTP Gmail, sans document). Aucun outil d'analytics
  ni de suivi d'erreurs n'est installé (`package.json` vérifié).

### Configurer les clés et suivre l'utilisation (administrateur M3AK) — console web

Une **console web** dédiée (`admin-web/`, voir son README) permet à l'administrateur de la plateforme de :
voir toutes les entreprises, configurer/modifier/retirer la clé Gemini de chacune, voir l'utilisation de l'OCR
cloud (analyses, échecs, tokens) et un **coût estimé** en USD/MAD (migrations `0033` et `0034`).

- **Qui y a accès :** uniquement les comptes présents dans `platform_admins` (ajout par SQL, une seule fois).
  Aucun utilisateur d'entreprise, même propriétaire, n'y a accès ; contrôle côté serveur, pas seulement dans la page.
- **Clé en écriture seule :** une fois enregistrée, elle ne peut plus être relue ; la console n'affiche que ses
  4 derniers caractères. L'application mobile ne contient plus aucun écran d'administration.
- **Droits limités :** aucun accès aux clients, véhicules ou locations des entreprises (testé).
- **Suivi d'utilisation :** une ligne de compteurs par analyse (entreprise, type de document, succès, tokens) ;
  jamais l'image, les valeurs lues ni la clé. La lecture sur le téléphone n'est pas comptée.
- **Coût :** ESTIMATION = tokens × tarif que vous saisissez, seulement pour les clés déclarées « payantes ».
  Le tarif Google n'est pas connu de l'application : tant qu'il n'est pas saisi, « Tarif non configuré ».
  La facture réelle est celle de Google.
- **Transparence :** chaque ajout ou retrait de clé est inscrit au journal de l'entreprise (sans la clé).
- **Ensuite :** le propriétaire de l'entreprise active l'analyse dans Mon entreprise → Lecture des documents.
  Retirer la clé retire aussi son accord.

Hygiène : ne collez jamais une clé dans un chat ou une capture d'écran ; en cas de fuite, révoquez-la chez Google
et remplacez-la depuis la console. Durcissement possible plus tard : Supabase Vault, bouton « tester la clé »,
authentification à deux facteurs obligatoire pour les administrateurs.

## 3. Protection au transfert et au stockage

- HTTPS vers Supabase (client `@supabase/supabase-js`, URL `https://…supabase.co`).
- Utilisateur authentifié (jeton Supabase) ; accès aux fichiers décidé **côté serveur** par les
  politiques RLS du stockage (`is_agency_member` / `can_access_storage_object`), par agence et par filiale.
- Buckets **privés**, sans URL publique ; consultation par **liens signés de 10 minutes**.
- Validation à l'envoi : type (JPEG/PNG/PDF), taille (15 Mo), fichier non vide, **contenu réel
  conforme au type annoncé** (signature binaire) ; et, depuis la migration `0031`, limites de taille
  et de types imposées par le serveur (un appel REST direct est aussi refusé).
- Suppression : réservée aux responsables (suppression douce du document, fichier détaché/retiré,
  historique conservé). L'employé ne peut effacer qu'un fichier orphelin.
- Journaux : aucun `console.*` dans le code de lecture locale ; la fonction `scan-document` ne journalise ni l'image, ni les valeurs lues, ni la clé (test automatique + relecture).

## 4. Conservation des documents (politique)

- Tant que le client est actif dans l'agence, ses documents sont conservés.
- Un responsable peut supprimer un document à tout moment ; le fichier est alors retiré du stockage.
- **Point ouvert** : aucune purge automatique par durée n'est implémentée. La durée de conservation
  légale (loi 09-08 au Maroc) doit être validée par l'agence ; ne pas affirmer qu'une purge existe.

## 5. Coûts

- `expo-text-extractor`, ML Kit (sur appareil) et Apple Vision : **0 € par lecture**, sans clé, sans compte, sans abonnement.
- Coûts d'infrastructure qui peuvent exister, **hors OCR** : l'hébergement Supabase (selon votre offre ;
  le stockage des photos conservées consomme du quota) et, pour fabriquer l'application,
  EAS Build (offre gratuite limitée ; au-delà, payant) ou Android Studio en local (gratuit), et le compte
  développeur Apple (99 USD/an) uniquement pour installer sur iPhone / publier sur l'App Store.
  Aucun de ces coûts n'est déclenché par un scan.

## 6. Installer la nouvelle version (module natif)

L'OCR local est un **module natif** : il ne fonctionne **pas dans Expo Go** (message « lecture
automatique indisponible » → saisie manuelle). Il faut une version de développement :

```bash
git pull && npm install
npx expo run:android      # Android Studio requis ; ou : eas build --profile development --platform android
```

Côté Supabase : exécuter `supabase/migrations/0031_document_buckets_limits.sql` (SQL Editor), puis
**supprimer** les anciennes fonctions `scan-customer-document` et `scan-vehicle-document`
(Edge Functions) et le secret `GEMINI_API_KEY` (et `ANTHROPIC_API_KEY` s'il existe).

## 7. Résultats de vérification

| Vérification | Résultat |
|---|---|
| Aucun appel réseau dans les modules de lecture locale (test automatique) | PASS |
| Aucune image envoyée sans clé + accord du propriétaire ; seul appel possible : `scan-document` ; repli = lecture locale (tests) | PASS |
| La fonction serveur n'utilise que la clé de l'entreprise (pas de variable d'environnement globale, pas d'autre fournisseur) (test) | PASS |
| La clé Gemini n'est lisible/écrivable par aucun utilisateur de l'app ; accord réservé au propriétaire ; isolation entre entreprises (tests SQL) | PASS |
| Console web : accès réservé, clé en écriture seule, usage et coût (tests SQL), calculs et garde-fous de la page (tests Jest) | PASS |
| Console web testée dans un vrai navigateur connecté à votre projet Supabase | NOT VERIFIED |
| Appel réel à Gemini avec une clé d'entreprise (déploiement + test sur appareil) | NOT VERIFIED |
| Code natif de `expo-text-extractor` relu : aucun appel réseau | PASS (relecture manuelle) |
| Texte OCR / champs absents des journaux (aucun `console.*` dans le code OCR) | PASS (test automatique) |
| Lecture des champs sur textes OCR simulés (permis, carte grise spécimen, mises en page variées) | PASS (21 tests) |
| Saisie manuelle quand l'OCR est indisponible ou échoue | PASS (tests de la logique) ; écran NOT VERIFIED sur appareil |
| Téléversement : type, taille, contenu, réseau coupé → erreur propre | PASS (tests unitaires) |
| Reprise après échec d'envoi : le document peut être rajouté depuis la fiche | NOT VERIFIED sur appareil (logique existante) |
| Isolation entre agences sur les fichiers (lecture, suppression) | PASS (tests SQL sur PostgreSQL local) |
| Buckets privés, limites de taille/type côté serveur | PASS (tests SQL) ; NOT VERIFIED sur votre projet Supabase tant que 0031 n'est pas exécutée |
| **Qualité de lecture sur de vrais permis / vraies cartes grises sur téléphone** | **NOT VERIFIED** |
| **Inspection du trafic réseau d'un vrai téléphone pendant un scan** | **NOT VERIFIED** (non réalisable dans cet environnement) |
| Téléchargement du modèle ML Kit par Google Play Services (Android) | NOT VERIFIED (comportement documenté par Google, non observé) |

Ne pas déclarer la confidentialité « garantie » tant que les deux lignes en gras ne sont pas vérifiées sur un appareil.
