# Design M3ak

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides). Le nom de l'application est **M3ak** (le renommage en « Kriha » a été abandonné) et sa palette est la **palette officielle M3ak** (mauve).

## Logo
Logos fournis par le propriétaire : `assets/images/logo-m3ak.png` (avec le nom) et `logo-m3ak-mark.png` (tuile seule). Le composant `Logo` affiche la tuile + le nom ; l'icône iOS (`icon.png`), les icônes Android, l'écran de lancement et le favicon en sont tirés.

## Palette M3ak
Révisée pour se rapprocher de la maquette cible (violets plus lumineux, lavandes brillantes, aubergines profonds) : noir violet `#171126`, aubergine `#321943`, violet profond `#54216F`, violet lumineux `#9438D8` (boutons, navigation, liens), lavande brillante `#CB83F5` (accents sur fond sombre), fond lavande `#F8F3FC`. Les couleurs fonctionnelles ci-dessous sont inchangées.
Jetons dans `src/constants/theme.ts` (`M3akPalette`, `Shadows`, `Typefaces`) et `tailwind.config.js` (classes `bg-brand`, `border-line`, `bg-canvas`, `bg-primary`, `text-on-primary`…). **Aucune couleur de marque écrite en dur** : toujours un jeton. Les noms historiques `mauve*` sont des RÔLES (voir le commentaire de `theme.ts`).

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Noir aubergine | `aubergine`, `ink` | `#171126` | fonds sombres, titres, texte principal |
| Mauve profond | `mauveDeep`, `brand-deep` | `#321943` | hero, cartes premium (revenus), menu latéral PC. Blanc dessus : 14:1 |
| Mauve signature | `mauve`, `primary`, `brand` | `#9438D8` | boutons, navigation, liens. Blanc dessus : 7,45:1 ; sur le fond ivoire : 6,9:1 |
| Lavande douce | `lavender` | `#CB83F5` | accents sur fond sombre (5,8:1 sur le mauve profond) |
| Blanc ivoire | `background`, `canvas` | `#F8F3FC` | fond principal |
| Blanc pur | `surface` | `#FFFFFF` | cartes et surfaces |
| Texte secondaire | `muted` | `#675A7E` | lisible (≥ 4,5:1) sur toutes les surfaces |

### Couleurs fonctionnelles
Les teintes d'origine servent aux **pastilles, icônes et fonds** ; pour du **texte sur clair** on prend la variante `*Text`, plus foncée (l'ambre n'atteint que 2,5:1 sur blanc). Test : `theme-contrast.test.ts`.

| Sens | Pastille / icône | Texte | Fond clair | Statuts concernés |
|---|---|---|---|---|
| Disponible / succès | `success` `#17856A` | `successText` `#116B54` | `successLight` | véhicule disponible, location terminée |
| En location / information | `info` `#5479C7` | `infoText` `#3F62AD` | `infoLight` | véhicule en location, location en cours |
| Maintenance / attention | `warning` `#D99835` | `warningText` `#8A5A0B` | `warningLight` | maintenance, à confirmer |
| Retard / erreur | `danger` `#C55461` | `dangerText` `#A83C4B` | `dangerLight` | retards, erreurs de saisie |
| Indisponible / neutre | `neutral` `#9692A3` | `neutralText` `#675A7E` | `neutralLight` | indisponible, annulée |

- **Typographie** : Plus Jakarta Sans (latin) et Cairo (arabe), une police par graisse (`fontFamilyFor`). Échelle : corps 14–16, titre de section 18, titre de page 28, grand chiffre 34.
- **Formes** : cartes 16 px (`rounded-2xl`), cartes vedettes 24 px, ombres très légères teintées mauve profond, zones tactiles ≥ 44.
- **Documents imprimés** (contrat, rapports, journal) : leurs couleurs propres, inchangées.

## Tableau de bord (Accueil)
- **Ordre sous le hero** : (bandeaux d'essai / premiers pas / logo manquant), trois compteurs (locations en cours, départs et retours du jour : `StatTrio`), carte du chiffre d'affaires en courbe (propriétaire seulement : `RevenueCard`, courbe lissée par `chart-path.ts`), « Accès rapide » (`QuickAccessTiles` : Nouvelle location, Réservations = calendrier, Parc véhicules, Clients ; « Tout voir » déplie Contrats, Maintenance, Chat, Entreprise, Journal selon le rôle), carte « Demander à M3ak », puis les sections existantes (finances, flotte, à venir, activité, performance, maintenance, alertes, IA). Cartes « verre » : dégradé blanc vers lavande pâle, liseré blanc, ombre mauve.
- **Hero** : photo (`assets/images/hero-m3ak.jpg`, Mercedes-AMG noire vue de face, image retournée, rouge → violet M3ak, plaque corrigée localement) sous un voile aubergine, logo M3ak, recherche (ouvre le chat), notifications (vrai nombre), profil, nom de l'agence, « Bonjour, prénom 👋 » et phrase d'accroche. Composant `DashboardHeader`. **Défilement** : le hero fait partie du contenu et défile normalement (il ne reste pas collé). Une petite barre fixe (logo M3ak, notifications, rond de profil) apparaît en fondu une fois le hero sorti de l'écran ; elle est pilotée par `scrollY` (Reanimated, fil d'interface). Photo calée à droite à côté du texte, voiles aubergine (gauche, haut, bas) et fondu final vers la couleur de la page.
- **Ouvertures M3ak (« Cinematic Ignition »)** : `src/features/opening/` (horloge unique `openingTime`, chronologies `opening-timeline.ts`, état `opening-state.ts`, mémoire `opening-storage.ts`, son `opening-sound.ts`, rideau + voiture du premier lancement `opening-gate.tsx`, apparitions `reveal.tsx`) et côté hero `car-lights.tsx` (voiture + effets lumineux), `hero-scene.tsx` (showroom + voiture), `hero-opening.tsx` (voile, lueur du logo).
  - **THE FIRST IGNITION** (3,8 s, une seule fois après l'installation) : 0–0,6 s obscurité · 0,6–1,4 s balayage de lumière violette sur la voiture · 1,4–2,1 s allumage des phares + moteur + halo + impulsion sur le sol · 2,1–3,0 s la voiture glisse du centre de l'écran à sa place dans le hero et le showroom apparaît · 3,0–3,8 s le dashboard s'éveille. Mémorisée (`m3ak.opening.first-played.v1`) uniquement si elle a été vue ou passée volontairement.
  - **INSTANT IGNITION** (1,65 s, à chaque lancement à froid suivant) : le dashboard est déjà utilisable, voile aubergine léger, moteur à 250 ms, phares, reflet violet, retour à l'éclairage normal. Jamais au retour d'une page, du background, d'un changement d'onglet ou d'un rafraîchissement (une seule fois par processus).
  - Son : `assets/audio/m3ak-engine-start.mp3` via `expo-audio` (mode silencieux respecté, volume 0,7, une seule instance, libéré après lecture, silence si indisponible). Préférence `m3ak.opening.sound.v1` (`setOpeningSoundEnabled(false)` pour le couper).
  - Images : `assets/images/ignition/` (`car-unlit.webp`, `car-lit.webp` = même voiture, seuls les phares diffèrent ; `showroom.webp`). Ignorées si animations réduites ou écran « bureau » ; la première ouverture est passée au toucher ; abandon si image absente / hero non prêt sous 4 s.

- **Période** : sélecteur `Aujourd'hui / 7 jours / 30 jours` (`PeriodTabs`). Elle pilote les chiffres « sur une durée » : revenus (comparés à la période précédente de même durée : veille, 7 jours précédents, 30 jours précédents), graphique (7 ou 30 barres), résultat, frais d'entretien, panier moyen, taux d'annulation, taux d'occupation, nouveaux clients, performance par véhicule. Ne dépendent PAS de la période : l'état de la flotte maintenant, le reste à encaisser, les départs/retours du jour, les retards, les locations à venir et l'analyse IA (qui garde le mois en cours : son format est fixé côté serveur).
- Le sélecteur de période est posé sur le bas du hero (verre sombre, période choisie en dégradé mauve) ; le hero n’a pas de coins arrondis et se fond dans la page par un dégradé vers l’ivoire. Carte des revenus mauve profond (propriétaire), cartes de statistiques blanches avec icône, « Locations à venir », bouton « Nouvelle location » mauve signature.

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
