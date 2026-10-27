# Design M3ak

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides).

## Couleurs (`src/constants/theme.ts`)
- **60 % neutre** : fond lavande très clair `#F7F4FF`, surfaces blanches.
- **30 %** : texte `#1E1633` (titres), `#5E5575` (secondaire, 6,5:1 sur blanc), `#8A82A0` (icônes seulement).
- **10 % accent** : violet vif `#7C3AED` (boutons principaux, sélection, point d'attention), `#5B21B6` pour le texte sur fond violet clair.
- Statuts : en attente = ambre, confirmée = bleu, en cours = violet, terminée = vert, annulée = gris. **Même statut, même couleur** partout (liste, badge, calendrier : `RENTAL_STATUS_STYLES`).
- **Un seul thème (clair)** : toutes les surfaces sont blanches ; suivre le mode sombre du téléphone donnait du texte clair sur fond blanc. `useColorScheme()` renvoie donc toujours « light » et `app.json` fixe `userInterfaceStyle: light`.
- Règle : **jamais de texte pâle sur fond pâle** ni de texte foncé sur fond foncé. Texte sur violet = blanc ; texte sur blanc = `ink` ou `muted`. Les champs de saisie imposent leur couleur de texte.

## Formes et profondeur
- Cartes `rounded-3xl`, bord `#E4DCF5`, **ombre douce teintée de violet** (`Shadows.card`) ; bouton principal avec ombre violette (`Shadows.button`). Pas d'ombre grise ou noire.
- Zones tactiles d'au moins **44 × 44**. Actions principales en bas de l'écran (zone du pouce).
- Espacements multiples de 4 / 8.

## Composants
- `Button` : principal (violet plein), secondaire (lavande), danger (rouge pâle).
- `TextField` : bord violet au focus, erreur rouge, avertissement ambre.
- `BottomTabBar` : pastille violette pleine sur l'onglet actif, étiquette contrastée.
- `KpiCard` : valeur en grand (la valeur prime sur l'intitulé), liseré de couleur selon le ton.

## Calendriers (`calendar-theme.ts`, `calendar-locale.ts`)
- Un thème commun : fond blanc, chiffres foncés, jour sélectionné violet plein, aujourd'hui en pastille lavande.
- Mois et jours **en français et en arabe**, semaine qui commence le **lundi**.
- Calendrier des locations : un point par statut présent ce jour-là, légende des statuts, liste colorée par statut.
- Sélection de dates : jours déjà réservés en pastille **rouge pâle avec chiffre rouge foncé** (lisibles, non sélectionnables), période choisie en violet.

## Chat M3ak (`features/chat/chat-bubble.tsx`)
- Bulle de l'utilisateur : violet vif, texte blanc, coin serré côté auteur. Bulle de M3ak : blanche, bord lavande, avatar « étincelle ».
- Heure sous chaque bulle, sources en pastilles cliquables, indicateur « M3ak écrit… » (trois points animés).
- Écran d'accueil du chat : avatar, phrase d'accueil et cartes de questions suggérées (état vide utile).
- Champ de saisie en bas, bouton d'envoi rond (violet quand il y a du texte, grisé sinon).

## Vérification
Les captures d'écran ont été prises en exportant l'app en version web (`npx expo export -p web`) et en l'ouvrant dans un navigateur. Le rendu sur iPhone n'a pas été vérifié par l'équipe de développement.
