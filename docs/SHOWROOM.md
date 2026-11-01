# Animation « showroom » de la voiture (hero de l'Accueil)

La voiture pivote doucement de **−8° à +8° puis revient** (aller-retour d'environ 7 secondes, jamais de tour complet), comme sur un plateau de showroom. **Seule la voiture bouge** : le bâtiment, le coucher de soleil, le logo, le message et le sélecteur de période restent fixes.

> **État actuel : préparée mais INACTIVE.** Tant que les images ci-dessous ne sont pas ajoutées, le hero affiche sa photo fixe actuelle, exactement comme avant. Aucune voiture n'est animée artificiellement en 2D : on n'anime que de vraies vues de la voiture sous plusieurs angles.

## Pourquoi il faut de nouveaux fichiers
Aujourd'hui, la voiture fait partie de la photo `assets/images/hero-dashboard.jpg` (un seul JPEG, sans transparence). On ne peut donc ni la détacher ni la faire pivoter proprement. Il faut :
1. une **séquence d'images de la voiture seule**, sous plusieurs angles, sur fond transparent ;
2. une version de la photo **sans la voiture** (bâtiment + ciel + sol), pour ne pas voir deux voitures.

## Fichiers attendus

### 1. La séquence de la voiture (25 images)
| | |
|---|---|
| **Dossier** | `assets/images/showroom/` |
| **Noms** | `car-00.webp`, `car-01.webp`, … `car-24.webp` (deux chiffres) |
| **Ordre** | de **−8°** (`car-00`) à **+8°** (`car-24`) ; `car-12` est à **0°** (vue de la photo actuelle) |
| **Pas** | 16° ÷ 24 intervalles ≈ 0,67° entre deux images |
| **Format** | **WebP avec transparence (canal alpha)**, 8 bits, sRGB. Qualité 80–85 avec alpha (ou sans perte si les bords sont abîmés) |
| **Dimensions** | **720 × 302 px** (rapport 2,38, identique à l'emplacement de la voiture dans la photo) |
| **Poids visé** | 25 à 45 Ko par image, soit environ 1 Mo au total |
| **Cadrage** | **Même canevas pour toutes les images** : la voiture reste au même endroit, les roues touchent la même ligne de sol, rien n'est coupé aux bords. Seul l'angle change |
| **Lumière** | Même éclairage, mêmes reflets et même teinte que la photo actuelle (coucher de soleil violet et orange). L'ombre de contact sous la voiture doit être dans les images (alpha doux) |

### 2. La photo sans voiture (1 image)
| | |
|---|---|
| **Fichier** | `assets/images/showroom/hero-no-car.jpg` |
| **Format** | JPEG qualité 82, sRGB |
| **Dimensions** | **1000 × 1094 px**, exactement comme `hero-dashboard.jpg` |
| **Contenu** | La même photo, au pixel près, mais sans la voiture (sol et reflets reconstitués sous elle) |

### Combien d'images ?
- **25 images (recommandé)** : entre deux images, l'app fait un fondu enchaîné calculé en continu (60 images/s), donc le mouvement paraît fluide, sans saccade.
- **33 images** si vous voulez un rendu encore plus doux (pas de 0,5°) : environ +30 % de poids, à peine visible.
- **Minimum accepté par le code : 9 images** ; en dessous, la séquence est ignorée et la photo reste fixe.
- Un nombre **impair** est préférable : il y a ainsi une image exacte à 0°.

## Comment les brancher
1. Copier les 26 fichiers dans `assets/images/showroom/`.
2. Ouvrir `src/features/dashboard/showroom/car-frames.ts` et remplacer les deux constantes `CAR_FRAMES` (liste des 25 `require`, dans l'ordre) et `HERO_BACKGROUND_NO_CAR` (un `require`). Les `require` doivent rester littéraux : c'est une règle de Metro (le compilateur de l'app).
3. Si la voiture ne tombe pas pile sur celle de la photo, ajuster `CAR_BOX` dans le même fichier (position et taille, en fractions de la photo).

## Comment l'animation fonctionne (Reanimated, compatible Expo Go)
- **Aucune dépendance native ajoutée.** On utilise Reanimated (déjà installé, déjà embarqué dans Expo Go) et `Animated.Image`. Pas de Skia, pas de Lottie, pas de module natif : l'app continue de s'ouvrir dans **Expo Go**, comme aujourd'hui, et fonctionne aussi dans une application compilée.
- **Une seule horloge** (`useFrameCallback`) sur le fil d'interface calcule la position de la voiture (mouvement sinusoïdal : elle ralentit doucement aux deux extrémités). Chaque image n'a qu'une **opacité animée** ; l'image du dessous est pleine et celle du dessus apparaît progressivement : c'est un vrai fondu, sans zone « creuse » là où deux images translucides se superposeraient.
- **Mémoire bornée** : seules 5 à 6 images voisines de la position courante sont montées en même temps (soit environ 4 Mo décodés au lieu de 18 Mo pour les 25). Android décode chaque image **à la taille affichée** (`resizeMethod="resize"`), jamais en pleine résolution.
- **Pas de JS pendant l'animation** : un seul changement d'état environ 7 fois par seconde (quand l'image du dessous change).
- **Suspension automatique** : l'horloge s'arrête (et reprend où elle s'était arrêtée) quand l'écran Accueil n'est plus affiché, quand l'application passe en arrière-plan, ou quand le hero est sorti de l'écran par le défilement.
- **Animations réduites** : si l'utilisateur les a désactivées dans les réglages du téléphone, la photo reste fixe.
- **Image de secours** : tant que l'image centrale n'est pas chargée, ou si une image échoue, le hero garde (ou retrouve) la photo fixe d'origine.
- Le hero reste en dehors de toute logique collante : il défile normalement, la voiture suit la légère parallaxe de la photo.

## Compiler l'application Android (APK de test et AAB de production)
Projet **Expo** (SDK 58) compilé par **EAS** ; il n'y a pas de dossier `android/` (il est généré à la compilation). État actuel de `eas.json` : profils `development`, `preview` (distribution interne) et `production` (numéro de version incrémenté automatiquement), sans type de livrable précisé.
- **AAB (Google Play)** : c'est le type par défaut d'EAS, donc `eas build --platform android --profile production` produit déjà un AAB.
- **APK de test** : par défaut le profil `preview` produit aussi un AAB (non installable directement). Pour obtenir un APK, il faudra ajouter dans `eas.json`, profil `preview` : `"android": { "buildType": "apk" }`. Ce changement n'est **pas fait** : il n'est pas nécessaire pour cette animation.
- `app.json` ne définit pas encore `android.package` (identifiant de l'application, par exemple `ma.m3ak.app`) : EAS le demandera au premier build Android, et il ne pourra plus changer ensuite.
