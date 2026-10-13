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

- **Analyse OCR : personne.** Aucune image ni aucun texte lu n'est envoyé à un service d'analyse.
  Les anciennes fonctions serveur `scan-customer-document` / `scan-vehicle-document` (qui
  envoyaient les photos à Gemini / Anthropic) et leur code partagé ont été **supprimées**.
- **Conservation (optionnelle)** : seulement si l'employé laisse cochée « Enregistrer la photo dans
  le dossier », l'image est envoyée au **backend M3AK (Supabase)**, dans un bucket privé
  (`client-documents` pour les permis, `vehicle-documents` pour les cartes grises). Décochée, la
  photo reste sur l'appareil et n'est pas téléversée.
- Autres flux sortants de l'app (inchangés, sans lien avec l'OCR) : Supabase (base, auth, stockage),
  fonction `send-invite` (e-mail d'invitation via SMTP Gmail, sans document). Aucun outil d'analytics
  ni de suivi d'erreurs n'est installé (`package.json` vérifié).

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
- Journaux : aucun `console.*` dans le code OCR ; le texte lu n'est jamais écrit (test automatique).

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
| Aucun appel réseau / service externe dans les modules OCR de l'app (test automatique) | PASS |
| Aucune référence à Gemini, Anthropic, OpenAI, Google Cloud Vision, Textract, Azure dans le code de l'app (test) | PASS |
| Fonctions serveur de lecture supprimées, plus appelées par l'app (test) | PASS |
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
