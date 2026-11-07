# Design BIBIP

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides). Le nom de l'application est **BIBIP** et sa palette est **Emerald Ivory** (émeraude `#087F70` sur ivoire `#FAF8F1`). Les identifiants techniques (slug Expo `m3ak`, scheme `m3ak`, clés de stockage `m3ak.*`, noms de fonctions serveur, tables) gardent leur nom d'origine : les renommer casserait les liens, les données locales et le serveur.

## Logo
Le logo BIBIP est un symbole « b » (trait + cercle) accompagné de deux ondes sonores orange, suivi du texte « bibip » en minuscules (Montserrat SemiBold 600). Fichiers sources : `assets/images/bibip-symbole-gris.svg` (« b » graphite `#202527`, fond clair) et `bibip-symbole-blanc.svg` (« b » blanc, fond sombre) ; les ondes sont toujours orange `#CA531D`. Ils ne se modifient pas (empreintes vérifiées par `brand-assets.test.ts`).

Le composant `Logo` (`src/components/logo.tsx`) redessine ces mêmes tracés avec `react-native-svg` : prop `symbolOnly` pour le symbole seul, `tone` (`dark` / `light` / `auto`) pour le fond. `scripts/build-brand-assets.py` fabrique les icônes : `icon.png` (fond graphite, « b » blanc, ondes orange, symbole ≈ 60 % de la largeur), `android-icon-foreground/background/monochrome.png`, `splash-icon.png` et `favicon.png`. L'icône de l'app est le symbole seul.

## Palette BIBIP « Graphite & Orange »
**Source de vérité unique : `src/constants/brand.js`** (jetons `light` et `dark`), lue par `src/constants/theme.ts` (`Brand`, `Themes`, `Palette`, `Shadows`, `Colors`) et par `tailwind.config.js`. Le thème sombre est préparé mais l'application reste forcée en clair (`userInterfaceStyle: "light"`).

| Rôle | Jeton | Clair | Sombre | Usage |
|---|---|---|---|---|
| Fond | `background` | `#FFFFFF` | `#202527` | fond des écrans |
| Surface / surface alt. | `surface`, `surfaceAlt` | `#F6F6F5`, `#EDEEEE` | `#2A3033`, `#343B3F` | zones douces, pastilles, champs |
| Carte | `card` | `#FFFFFF` | `#2A3033` | cartes : fond + bordure, **sans ombre** |
| Bordure | `border` | `#E2E4E5` | `#3F474B` | contours de cartes et de champs |
| Texte principal | `textPrimary` | `#202527` | `#FFFFFF` | titres et texte (graphite) |
| Texte secondaire / discret | `textSecondary`, `textMuted` | `#5E6466`, `#8A9092` | — | `textMuted` : décoratif ou grand texte seulement (2,99:1 sur `surface`) |
| Orange (action) | `primary` | `#CA531D` | — | **un seul bouton plein par écran** ; blanc dessus 4,4:1, donc texte 16 px minimum et gras |
| Orange appuyé | `primaryPressed` | `#A84416` | — | état pressé ; texte d'action sur teinte claire |
| Orange doux | `primarySoft`, `onPrimarySoft` | `#FBEDE6`, `#A84416` | — | sélections, pastilles |
| Orange en texte | `accentText` | `#CA531D` | `#EC7A45` | seulement ≥ 16 px ou en gras ; petits liens en graphite avec flèche orange |
| Graphite | `Brand.graphite` | `#202527` | — | hero, carte des revenus, onglet actif, puces sélectionnées |

### Couleurs fonctionnelles
| Sens | Jeton | Valeur | Fond doux |
|---|---|---|---|
| Succès / disponible | `success` | `#1A7F53` | `successSoft` `#E3F3EB` |
| Information / en location | `info` | `#3D6FB6` | `infoSoft` `#E6EEF8` (sombre `#223246`) |
| Attention / maintenance | `warning` | `#7A5A00` | `warningSoft` `#FFF6D6` |
| Erreur / suppression | `error` | `#C42B4B` | `errorSoft` `#FBE6EA` |

Règles : dégradés et ombres colorées supprimés ; seule ombre autorisée, grise et très légère (`Shadows.raised`) pour les éléments flottants (bouton « + », feuilles, fenêtres). Les actions destructrices sont un bouton contour/texte `error`, jamais un aplat primaire, toujours avec confirmation ; le rouge est interdit pour une action non destructrice.

- **Typographie** : Plus Jakarta Sans (latin) et Cairo (arabe), une police par graisse (`fontFamilyFor`). Échelle : corps 14–16, titre de section 18, titre de page 28, grand chiffre 34.
- **Formes** : cartes 16 px (`rounded-2xl`), cartes vedettes 24 px, pas d'ombre sur les cartes (fond blanc + bordure), zones tactiles ≥ 44.
- **Documents imprimés** (contrat, rapports, journal) : leurs couleurs propres, inchangées.

## Tableau de bord (Accueil)
- **Ordre sous le hero** : (bandeaux d'essai / premiers pas / logo manquant), trois compteurs (locations en cours, départs et retours du jour : `StatTrio`), carte du chiffre d'affaires en courbe (propriétaire seulement : `RevenueCard`, courbe lissée par `chart-path.ts`), « Accès rapide » (`QuickAccessTiles` : Nouvelle location, Réservations = calendrier, Parc véhicules, Clients ; « Tout voir » déplie Contrats, Maintenance, Chat, Entreprise, Journal selon le rôle), carte « Demander à M3ak », puis les sections existantes (finances, flotte, à venir, activité, performance, maintenance, alertes, IA). Cartes « verre » : dégradé blanc vers émeraude pâle, liseré blanc, ombre mauve.
- **Hero** : décor showroom au coucher du soleil (`assets/images/signature/showroom.webp`) et Mercedes noire en trois-quarts (`three-quarter.webp`), deux calques séparés ; voiles Deep Forest pour la lisibilité ; logo BIBIP (sur pastille ivoire), recherche (ouvre le chat), notifications (vrai nombre), profil, nom de l'agence, « Bonjour, prénom 👋 » et phrase d'accroche. Composant `DashboardHeader`. **Défilement** : le hero fait partie du contenu et défile normalement (il ne reste pas collé). Une petite barre fixe (logo BIBIP, notifications, rond de profil) apparaît en fondu une fois le hero sorti de l'écran ; elle est pilotée par `scrollY` (Reanimated, fil d'interface). Voiture calée à droite à côté du texte, fondu final vers la couleur de la page.
- **Ouverture (vidéo, 4,4 s, à chaque lancement à froid)** : `assets/video/bibip-intro-vertical-court.mp4` (1080×1920, H.264 + AAC), jouée par `expo-video` (`src/features/opening/intro-video.tsx`) sur un rideau noir plein écran (`cover`) posé par-dessus l'application, juste après le splash noir.
  - **Un toucher la passe** ; à la fin (ou au toucher) fondu de 350 ms vers l'application.
  - **Erreur ou démarrage trop lent (> 4 s)** : retour direct à l'application, sans écran d'erreur.
  - **Son** : mélangé à la musique éventuelle du téléphone (`audioMixingMode: 'mixWithOthers'`), elle n'est pas coupée.
  - **Vibration** : une seule, légère (`Light`), 0,85 s après le début de la lecture (allumage des phares), via `expo-haptics`.
  - Ignorée si animations réduites ou écran « bureau ». Jouée une seule fois par lancement à froid. `EXPO_PUBLIC_DISABLE_OPENING=1` la coupe (diagnostic).

- **Période** : sélecteur `Aujourd'hui / 7 jours / 30 jours` (`PeriodTabs`). Elle pilote les chiffres « sur une durée » : revenus (comparés à la période précédente de même durée : veille, 7 jours précédents, 30 jours précédents), graphique (7 ou 30 barres), résultat, frais d'entretien, panier moyen, taux d'annulation, taux d'occupation, nouveaux clients, performance par véhicule. Ne dépendent PAS de la période : l'état de la flotte maintenant, le reste à encaisser, les départs/retours du jour, les retards, les locations à venir et l'analyse IA (qui garde le mois en cours : son format est fixé côté serveur).
- Le sélecteur de période est posé sur le bas du hero (verre sombre, période choisie en dégradé émeraude) ; le hero n’a pas de coins arrondis et se fond dans la page par un dégradé vers l’ivoire. Carte des revenus émeraude profond (propriétaire), cartes de statistiques blanches avec icône, « Locations à venir », bouton « Nouvelle location » mauve signature.

## Calendriers (`calendar-theme.ts`, `calendar-locale.ts`)
- Un thème commun : fond blanc, chiffres foncés, jour sélectionné émeraude signature plein, aujourd'hui en pastille émeraude claire.
- Mois et jours **en français et en arabe**, semaine qui commence le **lundi**.
- Calendrier des locations : un point par statut présent ce jour-là, légende des statuts, liste colorée par statut.
- Sélection de dates : jours déjà réservés en pastille **rouge pâle avec chiffre rouge foncé** (lisibles, non sélectionnables), période choisie en émeraude.

## Chat BIBIP (`features/chat/chat-bubble.tsx`)
- Bulle de l'utilisateur : émeraude, texte blanc, coin serré côté auteur. Bulle de BIBIP : blanche, bord clair, avatar « étincelle ».
- Heure sous chaque bulle, sources en pastilles cliquables, indicateur « BIBIP écrit… » (trois points animés).
- Écran d'accueil du chat : avatar, phrase d'accueil et cartes de questions suggérées (état vide utile).
- Champ de saisie en bas, bouton d'envoi rond (émeraude quand il y a du texte, grisé sinon).

## Vérification
Les captures d'écran ont été prises en exportant l'app en version web (`npx expo export -p web`) et en l'ouvrant dans un navigateur. Le rendu sur iPhone n'a pas été vérifié par l'équipe de développement.
