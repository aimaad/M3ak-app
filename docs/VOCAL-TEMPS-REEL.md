# Mode vocal temps réel (chat BIBIP)

Une vraie conversation à voix haute avec BIBIP : on parle sans appuyer sur Envoyer, BIBIP répond presque tout de suite avec une voix
naturelle, on peut l'interrompre en parlant, il consulte les données de l'agence (mêmes outils et mêmes règles que le chat écrit) et
toute la conversation est enregistrée dans l'historique (texte seulement, **jamais d'audio**).

## Comment ça marche
```
Écran « Mode vocal » de l'app (orbe, sous-titres, cartes, boutons)            src/app/chat/vocal.tsx
   │  hook de session : jeton, outils, minuteurs, historique                   src/features/chat/live/use-live-session.ts
   │
   ├─ fonction chat-live-token : jeton éphémère verrouillé (modèle, consigne, voix, outils), limites de minutes
   ├─ fenêtre web interne INVISIBLE = moteur audio (micro en continu, annulation d'écho, voix)   prototypes/vocal-live/engine.html
   │       └─ connexion directe à Gemini Live avec le jeton (la clé de l'entreprise ne quitte jamais le serveur)
   └─ fonction chat-tools : exécute l'outil demandé avec les droits de l'utilisateur (RLS), sans montant hors propriétaire
```
Le moteur audio tourne dans une fenêtre web interne parce que le téléphone sait capter le micro en continu avec annulation d'écho
**dans Expo Go** (ce que les modules audio de l'app ne savent pas). Pour l'utilisateur, ce n'est pas une page web : tout ce qu'il voit est natif.

## Mise en place
1. Migration `0064_chat_live_sessions.sql` (SQL Editor, « Copy raw file »).
2. Fonctions : `npx supabase functions deploy chat-live-token --use-api` et `npx supabase functions deploy chat-tools --use-api`.
3. Moteur : publier le dossier `prototypes/vocal-live` en HTTPS (Netlify Drop, avec son `config.js`). Le fichier utilisé par l'app est `engine.html`.
4. `.env` de l'app : `EXPO_PUBLIC_VOCAL_ENGINE_URL=https://votre-site/` (sinon : `https://bibip-vocal.netlify.app/`), puis relancer `npx expo start --clear`.
5. L'agence doit avoir une clé Gemini (console d'administration) et le chat activé par le propriétaire (Mon entreprise → Chat BIBIP).

## Réglages (secrets Supabase, sans redéployer)
| Quoi | Secret | Défaut |
|---|---|---|
| Durée maximale d'une session | `LIVE_SESSION_SECONDS` | 600 |
| Minutes par utilisateur et par jour | `LIVE_USER_DAILY_SECONDS` | 600 |
| Minutes par agence et par jour | `LIVE_AGENCY_DAILY_SECONDS` | 1800 |
| Niveau de réflexion du modèle | `LIVE_THINKING_LEVEL` (`MINIMAL`, `LOW`, `MEDIUM`, `HIGH`) | `LOW` |
| Forcer un modèle Live | `LIVE_MODEL` | le plus récent disponible avec la clé |

Exemple : `npx supabase secrets set LIVE_USER_DAILY_SECONDS=1200`. La coupure après 30 s de silence est `SILENCE_CUTOFF_MS` dans `use-live-session.ts`.

## Repli
Si le moteur ne démarre pas, si la limite de minutes est atteinte ou si le micro est indisponible, l'écran propose **« Mode simple (tour par tour) »**
(`/chat/vocal-turns`, l'ancien mode : enregistrer, envoyer, réponse lue) et **« Passer à l'écrit »**.

## Limites connues
- L'écran reste allumé pendant une session (`expo-keep-awake`), donc le verrouillage automatique ne coupe plus la conversation. En revanche, la conversation s'arrête si l'écran est verrouillé à la main (bouton latéral) ou si l'app passe en arrière-plan (limite de la fenêtre web interne).
- La suppression d'écho dépend du navigateur du téléphone : des écouteurs donnent le meilleur résultat.
- Les montants ne sont retirés qu'au niveau des outils et de la consigne : à l'oral, le texte prononcé ne peut pas être filtré. Les sous-titres enregistrés, eux, sont filtrés.
- La version « tout natif » (build de développement, compte Apple Developer) pourra ajouter l'arrière-plan et l'appel entrant ; l'écran, l'historique et les limites resteront les mêmes.
