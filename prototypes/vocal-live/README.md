# Prototype BIBIP vocal temps réel (page web de test)

Page **de test interne** pour juger, sur un téléphone, la qualité de Gemini Live avant de construire le mode vocal dans l'app :
compréhension de la darija, voix, latence, interruption, appel d'un outil (« voitures libres ») avec les vraies données.
Elle n'est pas liée à l'app mobile et ne touche ni l'accueil ni Ma Flotte.

## Ce qu'elle fait
- Connexion avec un compte M3AK (e-mail et mot de passe), comme dans l'app.
- Bouton **Parler** : la page demande un **jeton éphémère** à la fonction `chat-live-token`, puis se connecte **directement** à Gemini Live.
  La clé Gemini n'est jamais dans la page. Le jeton est à usage unique, dure au plus la session, et verrouille modèle, consigne, voix et outil.
- Micro en continu (annulation d'écho du navigateur), voix de BIBIP en continu, sous-titres des deux côtés, interruption à la voix.
- Outil « voitures libres » : appelle `chat-tools`, qui exécute l'outil **avec vos droits** (mêmes règles que le chat écrit : aucun montant pour un responsable ou un employé).
- Mesures affichées : latence (fin de ma voix → premier son), délai d'interruption, durée, tokens, coût estimé.
- L'**audio n'est pas enregistré**. Seule la durée et les tokens de la session sont gardés (table `chat_live_sessions`) pour les limites et le coût.

## Mise en route (une seule fois)

1. **Migration** : dans Supabase → SQL Editor, exécutez `supabase/migrations/0064_chat_live_sessions.sql` (« Copy raw file »).
2. **Déployer les deux fonctions** (depuis le dossier du projet) :
   ```
   npx supabase functions deploy chat-live-token --use-api
   npx supabase functions deploy chat-tools --use-api
   ```
3. **Clé Gemini de l'agence** : déjà configurée dans la console d'administration pour l'agence de test (c'est la même clé que le chat).
   Pour les vraies agences, utilisez une **clé payante** : console d'administration → l'agence → « Modifier la clé » → collez la clé d'un projet Google
   où la facturation est activée → offre « Payante ». Le chat doit aussi être activé pour l'agence (réglage du propriétaire dans l'app).
4. **Configurer la page** : copiez `config.example.js` en `config.js` et renseignez l'URL du projet et la clé « anon » (comme pour `admin-web`).
5. **Mettre la page en ligne en HTTPS** (obligatoire pour le micro) — option la plus simple et gratuite : **Netlify Drop**.
   - Allez sur https://app.netlify.com/drop et glissez le dossier `prototypes/vocal-live` (avec votre `config.js`).
   - Netlify donne une adresse `https://….netlify.app` : c'est l'adresse de la page.
   - Pour la retirer après le test : Netlify → Site settings → Delete site.
   - Essai sur votre ordinateur sans mise en ligne : `cd prototypes/vocal-live && npx serve .` puis http://localhost:3000 (le micro marche sur localhost).

## Réglages

| Quoi | Où |
|---|---|
| Clé Gemini d'une agence (gratuite ou payante) | Console `admin-web` → l'agence → « Modifier la clé » |
| Durée max d'une session (défaut 600 s) | Secret Supabase `LIVE_SESSION_SECONDS` |
| Minutes par utilisateur et par jour (défaut 600 s) | Secret `LIVE_USER_DAILY_SECONDS` |
| Minutes par agence et par jour (défaut 1 800 s) | Secret `LIVE_AGENCY_DAILY_SECONDS` |
| Forcer un modèle Live précis | Secret `LIVE_MODEL` (sinon : le plus récent disponible avec la clé) |
| Coupure après silence (défaut 30 s) | `SILENCE_CUTOFF_MS` dans `app.js` |
| Tarif pour le coût estimé | `PRICE_PER_MILLION` dans `audio.js` (et `LIVE_PRICE_PER_MILLION` dans `chat-m3ak/logic.ts`) |

Exemple : `npx supabase secrets set LIVE_USER_DAILY_SECONDS=1200 LIVE_AGENCY_DAILY_SECONDS=3600`

## Test de 10 minutes sur iPhone (Safari)
1. Ouvrez l'adresse de la page dans **Safari**, connectez-vous, autorisez le micro. Mettez des écouteurs si possible.
2. **Darija** : appuyez sur Parler et dites par exemple « شنو هي الطوموبيلات الفارغين دابا؟ » puis « واش كاين شي طوموبيل خاوية غدا؟ ».
3. **Français et mélange** : « Quelles voitures sont libres demain ? », puis une phrase mêlant darija et français.
4. **Outil** : vérifiez que la liste des voitures apparaît sous les sous-titres et que BIBIP la résume sans la lire en entier.
5. **Montants** : avec un compte employé, demandez le prix d'une voiture : BIBIP doit dire qu'il n'a pas cette information.
6. **Interruption** : coupez BIBIP en parlant au milieu de sa réponse ; l'audio doit s'arrêter net et le délai s'affiche.
7. Notez : la latence médiane, la qualité de la voix (darija et français), les erreurs de compréhension, et le coût estimé de la session.
8. **Silence** : ne dites rien pendant 30 s : la session doit se terminer toute seule.

## Si ça ne marche pas
- « Aucun modèle Live disponible » : la clé de l'agence n'a pas accès à la Live API (vérifiez dans Google AI Studio).
- Erreur de connexion juste après « Connexion… » : envoyez-moi le message affiché et les lignes `Edge Functions → chat-live-token → Logs`.
- Pas de son sur iPhone : vérifiez que le téléphone n'est pas en mode silencieux et que l'onglet Safari est au premier plan.
- Un écho (BIBIP s'entend et s'interrompt) : utilisez des écouteurs ; sur haut-parleur, l'annulation d'écho de Safari peut être insuffisante.
