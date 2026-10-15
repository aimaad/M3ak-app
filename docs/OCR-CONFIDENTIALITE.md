# Lecture automatique des documents (OCR) — permis de conduire et cartes grises

Ce document décrit ce qui est **réellement** implémenté. Les points non vérifiés sont signalés `NOT VERIFIED`.

## 1. Principe

Il n'existe **qu'un seul moteur** : **Google Gemini**, appelé par la fonction serveur `scan-document` avec **la clé
d'API propre à chaque entreprise**. Il n'y a **plus d'OCR sur le téléphone** (la bibliothèque a été retirée) et
aucun autre fournisseur.

La lecture automatique est **active pour une entreprise** uniquement si **les deux conditions** sont vraies :
1. l'administrateur M3AK a enregistré une clé Gemini pour cette entreprise (console web `admin-web/`) ;
2. le **propriétaire** de l'entreprise a activé la fonction dans « Mon entreprise → Lecture automatique des documents ».

**Sinon, la fonction n'est pas active** : l'écran de scan affiche « La lecture automatique des documents n'est pas
active pour votre entreprise » et propose la **saisie manuelle**. Aucune image n'est envoyée à qui que ce soit ; il n'y a
pas de repli vers un autre moteur. Si Gemini échoue (quota, réseau, clé invalide), l'écran propose aussi la saisie manuelle.

## 2. Qui reçoit les images

- **Analyse :** Google Gemini, via la fonction serveur et la clé de l'entreprise, **uniquement** quand la fonction est active.
  Le message affiché avant le scan le dit explicitement (« la photo est envoyée à Google »).
- **Clé gratuite vs payante :** avec une clé de l'offre gratuite de Google, Google peut utiliser les images envoyées.
  Pour des données confidentielles en production, l'entreprise doit utiliser une clé dont la facturation est activée.
  L'app ne peut pas détecter l'offre de la clé : l'avertissement est montré au propriétaire à l'activation ; le choix
  de la clé revient à l'administrateur et à l'entreprise.
- **Conservation (optionnelle) :** si l'employé laisse cochée « Enregistrer la photo dans le dossier », l'image est envoyée
  au backend M3AK (Supabase), dans un bucket privé (`client-documents` pour les permis, `vehicle-documents` pour les
  cartes grises). Décochée, la photo n'est pas téléversée.
- Autres flux sortants (sans lien avec l'OCR) : Supabase (base, auth, stockage), fonction `send-invite` (e-mail d'invitation,
  sans document). Aucun outil d'analytics ni de suivi d'erreurs n'est installé.

## 3. Console web d'administration (`admin-web/`)

Réservée aux comptes de la table `platform_admins` (ajout par SQL, une seule fois). Elle permet de voir toutes les
entreprises, configurer/modifier/retirer leur clé (**écriture seule** : jamais relue, seuls les 4 derniers caractères
sont affichés), et de suivre l'utilisation (analyses, échecs, tokens) avec un **coût estimé** en USD/MAD.
- Le coût est une **estimation** : tokens × tarif saisi par l'administrateur, seulement pour les clés déclarées « payantes ».
  Le tarif Google n'est pas connu de l'application ; tant qu'il n'est pas saisi, « Tarif non configuré ». La facture réelle est celle de Google.
- Le suivi n'enregistre que des **compteurs** (entreprise, type de document, succès, tokens) : jamais l'image, les valeurs lues, ni la clé.
- L'administrateur plateforme n'a **aucun accès** aux clients, véhicules ou locations des entreprises (testé).
- Chaque ajout/retrait de clé est inscrit au journal de l'entreprise (sans la clé).
- Mot de passe oublié : code reçu par e-mail (voir `supabase/README.md`).

### Cache des lectures (sur l'appareil)
Si la **même photo** est relue pour la même entreprise, le résultat est repris du cache de l'appareil : aucun nouvel envoi à
Gemini, aucun quota ni coût consommé. Le cache ne sert que pour une lecture réussie (jamais une lecture vide ni un échec), reste
**sur l'appareil** (rien n'est stocké sur le serveur), dure **24 h**, contient au plus **20** lectures, est lié à l'entreprise, et
est **effacé à la déconnexion**. Il contient des données personnelles (noms, numéro de permis) : c'est pourquoi sa durée est courte.

## 4. Protection au transfert et au stockage

- HTTPS vers Supabase ; utilisateur authentifié ; accès aux fichiers décidé **côté serveur** par les politiques RLS du stockage,
  par entreprise et par filiale. Buckets **privés**, consultation par **liens signés de 10 minutes**.
- Validation à l'envoi : type (JPEG/PNG/PDF), taille (15 Mo), fichier non vide, **contenu réel conforme au type annoncé** ;
  limites de taille et de types imposées aussi par le serveur (migration `0031`).
- La clé de l'entreprise n'est lisible que par la fonction serveur (table sans policy, droits retirés à `anon`/`authenticated`),
  jamais renvoyée ni journalisée. La fonction ne journalise ni l'image, ni les valeurs lues, ni la clé.
- Suppression : réservée aux responsables (suppression douce, fichier retiré, historique conservé).

## 5. Conservation des documents (politique)

- Tant que le client est actif dans l'agence, ses documents sont conservés ; un responsable peut les supprimer à tout moment.
- **Point ouvert :** aucune purge automatique par durée n'est implémentée. La durée légale (loi 09-08) est à valider avec l'agence.

## 6. Coûts

- **Gemini :** clé gratuite = 0 (avec réserve de confidentialité ci-dessus et limites de quota de Google) ; clé payante = facturée
  par Google à l'usage, à la charge de l'entreprise ou de M3AK selon votre accord commercial.
- **Hébergement :** Supabase selon votre offre (le stockage des photos conservées consomme du quota).
- **Application :** plus de module natif d'OCR : l'app fonctionne de nouveau avec **Expo Go** (plus besoin de version de développement pour l'OCR).

## 7. Mise en service d'une entreprise

1. Déployer la fonction : `npx supabase functions deploy scan-document` (aucun secret global).
2. Console web : configurer la clé de l'entreprise (et son offre gratuite/payante, puis le tarif Google).
3. L'entreprise : le propriétaire active la lecture dans Mon entreprise.

## 8. Résultats de vérification

| Vérification | Résultat |
|---|---|
| Aucune bibliothèque d'OCR dans l'app ; seul appel possible : `scan-document` (tests statiques) | PASS |
| Sans clé ou sans accord : fonction « non active », aucun appel à Gemini, saisie manuelle proposée (tests) | PASS |
| La fonction n'utilise que la clé de l'entreprise (pas de clé globale, pas d'autre fournisseur) (test) | PASS |
| La clé n'est lisible/écrivable par aucun utilisateur de l'app ; accord réservé au propriétaire ; isolation entre entreprises (tests SQL) | PASS |
| Console web : accès réservé, clé en écriture seule, usage et coût (tests SQL), calculs et garde-fous de la page (tests Jest) | PASS |
| Isolation du stockage entre entreprises, buckets privés et limités (tests SQL) | PASS |
| Téléversement : type, taille, contenu, réseau coupé → erreur propre (tests) | PASS |
| Appel réel à Gemini avec une clé d'entreprise (déploiement + test sur appareil) | NOT VERIFIED |
| Qualité de lecture sur de vrais permis / vraies cartes grises | NOT VERIFIED |
| Console web testée dans un navigateur connecté à votre projet Supabase | NOT VERIFIED |
| Inspection du trafic réseau d'un vrai téléphone pendant un scan | NOT VERIFIED |
