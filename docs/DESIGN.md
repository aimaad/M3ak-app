# Design M3ak

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides). Le nom de l'application est **M3ak** (le renommage en « Kriha » a été abandonné) et sa palette est la **palette officielle M3ak** (mauve).

## Logo
Logos fournis par le propriétaire : `assets/images/logo-m3ak.png` (avec le nom) et `logo-m3ak-mark.png` (tuile seule). Le composant `Logo` affiche la tuile + le nom ; l'icône iOS (`icon.png`), les icônes Android, l'écran de lancement et le favicon en sont tirés.

## Palette officielle M3ak
Jetons dans `src/constants/theme.ts` (`M3akPalette`, `Shadows`, `Typefaces`) et `tailwind.config.js` (classes `bg-brand`, `border-line`, `bg-canvas`, `bg-primary`, `text-on-primary`…). **Aucune couleur de marque écrite en dur** : toujours un jeton. Les noms historiques `mauve*` sont des RÔLES (voir le commentaire de `theme.ts`).

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Noir aubergine | `aubergine`, `ink` | `#171321` | fonds sombres, titres, texte principal |
| Mauve profond | `mauveDeep`, `brand-deep` | `#35204F` | hero, cartes premium (revenus), menu latéral PC. Blanc dessus : 14:1 |
| Mauve signature | `mauve`, `primary`, `brand` | `#684394` | boutons, navigation, liens. Blanc dessus : 7,45:1 ; sur le fond ivoire : 6,9:1 |
| Lavande douce | `lavender` | `#B69ACF` | accents sur fond sombre (5,8:1 sur le mauve profond) |
| Blanc ivoire | `background`, `canvas` | `#F7F5FA` | fond principal |
| Blanc pur | `surface` | `#FFFFFF` | cartes et surfaces |
| Texte secondaire | `muted` | `#625C74` | lisible (≥ 4,5:1) sur toutes les surfaces |

### Couleurs fonctionnelles
Les teintes d'origine servent aux **pastilles, icônes et fonds** ; pour du **texte sur clair** on prend la variante `*Text`, plus foncée (l'ambre n'atteint que 2,5:1 sur blanc). Test : `theme-contrast.test.ts`.

| Sens | Pastille / icône | Texte | Fond clair | Statuts concernés |
|---|---|---|---|---|
| Disponible / succès | `success` `#17856A` | `successText` `#116B54` | `successLight` | véhicule disponible, location terminée |
| En location / information | `info` `#5479C7` | `infoText` `#3F62AD` | `infoLight` | véhicule en location, location en cours |
| Maintenance / attention | `warning` `#D99835` | `warningText` `#8A5A0B` | `warningLight` | maintenance, à confirmer |
| Retard / erreur | `danger` `#C55461` | `dangerText` `#A83C4B` | `dangerLight` | retards, erreurs de saisie |
| Indisponible / neutre | `neutral` `#9692A3` | `neutralText` `#625C74` | `neutralLight` | indisponible, annulée |

- **Typographie** : Plus Jakarta Sans (latin) et Cairo (arabe), une police par graisse (`fontFamilyFor`). Échelle : corps 14–16, titre de section 18, titre de page 28, grand chiffre 34.
- **Formes** : cartes 16 px (`rounded-2xl`), cartes vedettes 24 px, ombres très légères teintées mauve profond, zones tactiles ≥ 44.
- **Documents imprimés** (contrat, rapports, journal) : leurs couleurs propres, inchangées.

## Tableau de bord (Accueil)
- **Hero** : photo (`assets/images/hero-dashboard.jpg`) sous un voile aubergine, logo M3ak, recherche (ouvre le chat), notifications (vrai nombre), profil, nom de l'agence, « Bonjour, prénom 👋 » et phrase d'accroche. Composant `DashboardHeader`. **Repli au défilement** : le hero rétrécit en douceur (hauteur, photo et texte qui s'estompent, coins qui s'affinent) puis laisse place à une petite barre (logo M3ak, notifications et rond de profil). Animation Reanimated pilotée par la position de défilement (`scrollY`) sur le fil d'interface ; le hero est posé par-dessus la liste, qui réserve sa hauteur, donc le contenu ne bouge pas pendant le repli.
- **Période** : sélecteur `Aujourd'hui / 7 jours / 30 jours` (`PeriodTabs`). Elle pilote les chiffres « sur une durée » : revenus (comparés à la période précédente de même durée : veille, 7 jours précédents, 30 jours précédents), graphique (7 ou 30 barres), résultat, frais d'entretien, panier moyen, taux d'annulation, taux d'occupation, nouveaux clients, performance par véhicule. Ne dépendent PAS de la période : l'état de la flotte maintenant, le reste à encaisser, les départs/retours du jour, les retards, les locations à venir et l'analyse IA (qui garde le mois en cours : son format est fixé côté serveur).
- Carte des revenus mauve profond (propriétaire), cartes de statistiques blanches avec icône, « Locations à venir », bouton « Nouvelle location » mauve signature.

## Calendriers (`calendar-theme.ts`, `calendar-locale.ts`)
- Un thème commun : fond blanc, chiffres foncés, jour sélectionné mauve signature plein, aujourd'hui en pastille lavande.
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
