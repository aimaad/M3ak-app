# Design Kriha (anciennement M3ak)

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides).

## Logo (ancien, M3ak)
Logos fournis par le propriétaire : `assets/images/logo-m3ak.png` (avec le nom) et `logo-m3ak-mark.png` (tuile seule). L'icône iOS (`icon.png`), les icônes Android, l'écran de lancement et le favicon en sont tirés ; violet de référence `#773DBA`. Le composant `Logo` les affiche dans l'app.

## Design system Kriha (vert premium)
Source : skill `.claude/skills/kriha-ui-designer` (planche de référence = inspiration, pas une spécification). Jetons dans `src/constants/theme.ts` (`M3akPalette`, `Shadows`, `Typefaces`) et `tailwind.config.js` (classes `bg-brand`, `border-line`, `bg-canvas`, `bg-emerald`…). **Aucune couleur de marque écrite en dur** : toujours un jeton. Les noms historiques `mauve*` sont des RÔLES (voir le commentaire de `theme.ts`).

| Rôle | Valeur | Usage |
|---|---|---|
| action (`mauve`, `brand`) | `#007A59` | texte et icônes sur clair, fonds portant du texte blanc (5,35:1) |
| forêt (`mauveDeep`, `brand-deep`) | `#064E3B` | carte vedette (revenus), menu latéral PC, titres |
| émeraude (`emerald`) | `#00B884` | **bouton principal**, boutons flottants, pastille d'onglet actif. Texte dessus : `#04271E` (6,2:1) ; jamais du blanc (2,56:1) |
| fond / surface | `#F5FAF8` / `#FFFFFF` | canevas / cartes |
| texte | `#172B26`, secondaire `#566774` | lisibles sur toutes les surfaces (test `theme-contrast.test.ts`) |
| bordure | `#E5EDE9` | cartes et champs |
| statuts | succès `#15803D`, alerte `#B45309`, danger `#DC2626`, info `#2563EB` | le vert est la marque, pas le seul statut ; « en cours » = pastille forêt, « terminée » = vert clair |

- **Typographie** : Plus Jakarta Sans (latin) et Cairo (arabe), une police par graisse (`fontFamilyFor`). Échelle : corps 14–16, titre de section 18, titre de page 28, grand chiffre 34.
- **Formes** : cartes 16 px (`rounded-2xl`), cartes vedettes 24 px, ombres très légères teintées forêt, zones tactiles ≥ 44.
- **Documents imprimés** (contrat, rapports, journal) : leurs couleurs propres, inchangées.
- **Tableau de bord** : carte des revenus forêt (propriétaire), cartes de statistiques blanches avec icône, « Locations à venir », bouton « Nouvelle location » émeraude.
- Logo provisoire : pastille émeraude « K » + nom (composant `Logo`) ; l'icône et l'écran de lancement de l'app restent les anciens fichiers jusqu'à réception du logo officiel.

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
