# Design BIBIP

Principes tirés du skill `mobile-app-ui-design` (règles 60/30/10, grille de 8, ombres douces, hiérarchie, contraste, états vides). Le nom de l'application est **BIBIP** et sa palette est **Emerald Ivory** (émeraude `#087F70` sur ivoire `#FAF8F1`). Les identifiants techniques (slug Expo `m3ak`, scheme `m3ak`, clés de stockage `m3ak.*`, noms de fonctions serveur, tables) gardent leur nom d'origine : les renommer casserait les liens, les données locales et le serveur.

## Logo
Le logo officiel BIBIP (fichier fourni : `assets/branding/BIBIP_logo_exact.svg`, un PNG transparent intégré) est **définitif et ne se modifie jamais** : ni formes, ni couleurs (verts et accent lime), ni dégradés, ni transparence. Il n'est ni recréé en CSS/SVG ni recoloré pour suivre la palette de l'interface : le logo et l'interface ont chacun leurs couleurs.

`scripts/build-brand-assets.py` en extrait le PNG (octets identiques), rogne les marges vides et fabrique les tailles utiles : `assets/images/logo-bibip.png` (usage dans l'app), `icon.png` (iOS, fond ivoire car pas de transparence), `android-icon-foreground/background/monochrome.png`, `splash-icon.png` et `favicon.png`. La silhouette « monochrome » est exigée par Android 13 (icône thématique), c'est le masque de transparence du logo. Le composant `Logo` / `LogoMark` (`src/components/logo.tsx`) affiche le logo + le nom « BIBIP » (le logo n'a pas de mot-symbole) : sur fond clair il est posé tel quel, **sur fond sombre il est posé sur une pastille ivoire arrondie** (il garde ses couleurs et reste lisible).

## Palette BIBIP « Emerald Ivory »
**Source de vérité unique : `src/constants/brand.js`**, lue par `src/constants/theme.ts` (`BibipPalette`, `Shadows`, `Colors`, `Typefaces`) et par `tailwind.config.js` (classes `bg-brand`, `border-line`, `bg-canvas`, `bg-primary`, `text-on-primary`, `border-mint`…). **Aucune couleur de marque écrite en dur** : toujours un jeton. Les noms sont des rôles (`primary` = émeraude signature). Test : `src/constants/__tests__/theme-contrast.test.ts` (valeurs imposées, contrastes WCAG AA, tailwind aligné sur le thème).

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Émeraude signature | `primary`, `brand` | `#087F70` | boutons, navigation, liens. Blanc dessus : 4,9:1 ; sur l'ivoire : 4,6:1 |
| Émeraude appuyé | `primaryPressed` | `#066B5F` | état pressé ; texte d'action sur teintes claires (5,4:1) |
| Émeraude profond | `primaryDeep`, `brand-deep` | `#0A3A34` | hero, cartes premium (revenus), menu latéral PC. Blanc dessus : 12,6:1 |
| Vert nuit | `night` | `#06211D` | fonds les plus sombres (ouverture), contraste texte sur ambre |
| Teintes claires | `primaryLight`, `primarySoft` | `#DDF1EC`, `#EEF7F4` | sélections, pastilles, fonds doux |
| Menthe | `mint` | `#7DDCC8` | accents sur fond sombre (7,8:1 sur l'émeraude profond) |
| Lime | `lime` | `#C9F333` | accent du logo : petites touches sur fond sombre (traits, points) |
| Ivoire | `background`, `canvas` | `#FAF8F1` | fond principal |
| Blanc pur | `surface` | `#FFFFFF` | cartes et surfaces |
| Texte principal | `ink` | `#202B29` | titres et texte (13,7:1 sur l'ivoire) |
| Texte secondaire | `muted` | `#5B6866` | lisible (≥ 4,5:1) sur toutes les surfaces |
| Bordures | `border`, `borderSoft` | `#E7E3D4`, `#F0EDE1` | contours de cartes et de champs (`border-line`) |

### Couleurs fonctionnelles
Les teintes d'origine servent aux **pastilles, icônes et fonds** ; pour du **texte sur clair** on prend la variante `*Text`, plus foncée (l'ambre n'atteint que 2,5:1 sur blanc). Le vert « succès » est volontairement distinct de l'émeraude de la marque ; le rouge et l'ambre restent des couleurs purement fonctionnelles. Test : `theme-contrast.test.ts`.

| Sens | Pastille / icône | Texte | Fond clair | Statuts concernés |
|---|---|---|---|---|
| Disponible / succès | `success` `#2E8B57` | `successText` `#1E6B3A` | `successLight` | véhicule disponible, location terminée |
| En location / information | `info` `#5479C7` | `infoText` `#3F62AD` | `infoLight` | véhicule en location, location en cours |
| Maintenance / attention | `warning` `#D99835` | `warningText` `#8A5A0B` | `warningLight` | maintenance, à confirmer |
| Retard / erreur | `danger` `#C8443B` | `dangerText` `#A8322B` | `dangerLight` | retards, erreurs de saisie |
| Indisponible / neutre | `neutral` `#8E9693` | `neutralText` `#5B6866` | `neutralLight` | indisponible, annulée |

- **Typographie** : Plus Jakarta Sans (latin) et Cairo (arabe), une police par graisse (`fontFamilyFor`). Échelle : corps 14–16, titre de section 18, titre de page 28, grand chiffre 34.
- **Formes** : cartes 16 px (`rounded-2xl`), cartes vedettes 24 px, ombres très légères teintées émeraude profond, zones tactiles ≥ 44.
- **Documents imprimés** (contrat, rapports, journal) : leurs couleurs propres, inchangées.

## Tableau de bord (Accueil)
- **Ordre sous le hero** : (bandeaux d'essai / premiers pas / logo manquant), trois compteurs (locations en cours, départs et retours du jour : `StatTrio`), carte du chiffre d'affaires en courbe (propriétaire seulement : `RevenueCard`, courbe lissée par `chart-path.ts`), « Accès rapide » (`QuickAccessTiles` : Nouvelle location, Réservations = calendrier, Parc véhicules, Clients ; « Tout voir » déplie Contrats, Maintenance, Chat, Entreprise, Journal selon le rôle), carte « Demander à M3ak », puis les sections existantes (finances, flotte, à venir, activité, performance, maintenance, alertes, IA). Cartes « verre » : dégradé blanc vers émeraude pâle, liseré blanc, ombre mauve.
- **Hero** : décor showroom au coucher du soleil (`assets/images/signature/showroom.webp`) et Mercedes noire en trois-quarts (`three-quarter.webp`), deux calques séparés ; voiles Deep Forest pour la lisibilité ; logo BIBIP (sur pastille ivoire), recherche (ouvre le chat), notifications (vrai nombre), profil, nom de l'agence, « Bonjour, prénom 👋 » et phrase d'accroche. Composant `DashboardHeader`. **Défilement** : le hero fait partie du contenu et défile normalement (il ne reste pas collé). Une petite barre fixe (logo BIBIP, notifications, rond de profil) apparaît en fondu une fois le hero sorti de l'écran ; elle est pilotée par `scrollY` (Reanimated, fil d'interface). Voiture calée à droite à côté du texte, fondu final vers la couleur de la page.
- **Ouverture (3,7 s, à chaque lancement à froid)** : un seul geste, comme une vraie voiture qui s'éveille dans le noir. Code : `src/features/opening/` (horloge unique `openingTime`, chronologie `opening-timeline.ts`, scène `ignition-stage.tsx`, enveloppe `opening-gate.tsx`).
  1. 0,0–0,9 s : écran noir, la silhouette de la Mercedes émerge à peine (`assets/images/ignition/dark.webp`).
  2. 0,9–2,1 s : la voiture s'allume progressivement (fondu continu vers `lit.webp` : phares, reflets sur le sol, ligne de lumière émeraude). Les deux photos ont les mêmes dimensions et le même cadrage, seule la lumière change.
  3. 2,1 s : le moteur démarre une fois la voiture allumée : `assets/audio/m3ak-engine-start.mp3` (1,04 s) est le fichier fourni **rogné de ses 0,31 premières secondes** (bruit d'amorce) pour commencer directement par la montée du moteur (original conservé dans `assets/audio/source/`). **Vibration** douce (`opening-haptics.ts`, `expo-haptics`) : 18 impulsions qui suivent l'enveloppe du son, jamais plus fortes que « léger », décalées de `SOUND_LATENCY` = 60 ms comme la sortie audio. Préférence `m3ak.opening.haptics.v1` (`setOpeningHapticsEnabled(false)`) ; `EXPO_PUBLIC_DISABLE_OPENING_HAPTICS=1` la coupe pour un test.
  4. 3,0–3,7 s : le noir se retire en douceur sur l'application.
  - Aucune autre animation (plus de ligne, tracé du B, logo volant, voiture qui glisse, apparitions décalées). Seules des opacités sont animées (fil d'interface).
  - Se lance une fois la session prête et le hero affiché ; jamais au changement d'onglet ni au retour d'une page. Ignorée si animations réduites ou écran « bureau » ; un toucher la passe ; abandon sans bloquer le dashboard si une image est absente ou si le hero n'est pas prêt sous 4 s. Interrupteur de diagnostic : `EXPO_PUBLIC_DISABLE_OPENING=1`.
  - Son : `assets/audio/m3ak-engine-start.mp3` via `expo-audio` (mode silencieux respecté, volume 0,7, une seule instance, libéré après lecture, silence si indisponible). Préférence `m3ak.opening.sound.v1` (`setOpeningSoundEnabled(false)` pour le couper) ; `EXPO_PUBLIC_DISABLE_OPENING_SOUND=1` le coupe pour un test.

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
