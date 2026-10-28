# Version web (PC de l'agence)

Même application que le mobile, affichée dans un navigateur. Sur un écran large (≥ 1024 px) :
- **menu latéral** à la place de la barre du bas (rôles respectés : Journal = propriétaire, Filiales/Entreprise = responsables) ;
- **tableaux** (flotte, clients, locations, contrats) avec colonnes, survol, clic pour ouvrir la fiche, et **export CSV** de toute la liste filtrée (Excel français : séparateur « ; », accents et arabe corrects) ;
- **impression directe** (boîte d'impression du navigateur → imprimante ou « Enregistrer en PDF ») : contrat, rapport d'inspection, journal de traçabilité ;
- sur petit écran ou mobile, rien ne change.

## Publier (Netlify, gratuit)
1. `npm run build:web` (lit `.env` : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) → dossier `dist`.
2. Glisser `dist` sur https://app.netlify.com/drop. Le fichier `public/_redirects` fait fonctionner les adresses à identifiant (`/clients/<id>`…).
3. Plus tard : brancher un nom de domaine dans Netlify (Domain management).

## Limites connues
- Pas de notifications push dans le navigateur (la cloche et la page Notifications fonctionnent).
- L'inspection par caméra et le mode hors ligne sont conçus pour le téléphone ; sur PC, privilégier le mobile pour photographier la voiture.
- Les envois de fichiers n'affichent pas la progression octet par octet.
