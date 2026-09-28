# M3ak (معاك)

Application mobile tout-en-un pour les agences de location de voitures au Maroc.
Voir `docs/PRODUIT.md`, `docs/ARCHITECTURE.md` et `docs/ROADMAP.md` pour le contexte complet.

## Démarrer en local

```bash
npm install
cp .env.example .env   # puis remplir avec les clés du projet Supabase
npm start
```

Scannez le QR code avec l'app **Expo Go** (iOS/Android) pour tester sur votre téléphone.

## Scripts utiles

- `npm start` — lance le serveur de développement Expo
- `npm run typecheck` — vérifie les types TypeScript
- `npm run lint` — vérifie le style de code
- `npm test` — lance les tests

## Base de données (Supabase)

Le schéma SQL et les policies RLS sont dans [`supabase/migrations`](./supabase/migrations).
Voir [`supabase/README.md`](./supabase/README.md) pour les instructions de déploiement.
