# Voiture 360° du hero (vidéo du vrai modèle 3D)

La Maybach de l'Accueil tourne sur elle-même à 360°, en boucle (6 s). C'est un **rendu Blender du vrai modèle 3D** (`mercedes-benz_maybach_2022.glb`), pas une image 2D que l'on fait pivoter. La vidéo contient aussi le décor du hero, et se superpose à l'ancienne voiture de la photo.

## Fichiers
| Fichier | Rôle |
|---|---|
| `.claude/skills/m3ak-car-360/assets/mercedes-benz_maybach_2022.glb` | modèle 3D source (2,4 M de faces, 81,5 Mo, **hors de l'app** : seul le MP4 est embarqué) |
| `assets/images/showroom/hero-no-car.jpg` | la photo du hero SANS voiture (1000 × 1094), décor du rendu |
| `assets/images/showroom/car-turntable.mp4` | la vidéo en boucle (H.264 High, 720 × 480, 30 i/s, sans son) |
| `src/features/dashboard/turntable/turntable-assets.ts` | branche la vidéo (`TURNTABLE_VIDEO`, `null` = hero inchangé) et sa zone `TURNTABLE_BOX` |
| `src/features/dashboard/turntable/turntable-video.tsx` | lecteur (expo-video) : muet, boucle, pause hors écran |

> **État actuel : aperçu rapide** (120 images, 600 × 400, 16 échantillons, 555 Ko, 4 s par tour). Il montre bien la rotation mais il est plus granuleux que le rendu final : refaire le rendu avec la commande ci-dessous (180 images, 720 × 480, 40 échantillons) pour la qualité définitive.

## Fabriquer la vidéo
Blender se pilote depuis Python (`pip install bpy` dans un environnement isolé). Rendu des 180 images (environ 1 h sur 4 cœurs) :
```
python .claude/skills/m3ak-car-360/scripts/render_turntable.py \
  --model .claude/skills/m3ak-car-360/assets/mercedes-benz_maybach_2022.glb \
  --output frames --frames 180 --width 720 --height 480 --samples 40 --paint auto --fill 0.95 --shift-y 0.025
sh .claude/skills/m3ak-car-360/scripts/encode_video.sh frames car-turntable 30 assets/images/showroom/hero-no-car.jpg
```
Réglages utiles : `--device auto` (carte graphique si disponible, bien plus rapide que le processeur), `--paint keep` (garde la peinture d'origine), `--paint-color`, `--env-strength`, `--light-scale` (lumière), `--fill` (taille de la voiture), `--shift-y` (hauteur dans le cadre), `--start-view` (angle de départ). `CRF=26 sh encode_video.sh …` allège la vidéo.

Principes : la voiture tourne autour de son axe vertical, caméra et décor sont fixes ; angle = 2π·i/N, donc la dernière image n'est pas une copie de la première et la boucle est continue ; l'ombre portée est le seul élément posé sur la photo.

## Comportement dans l'app
- **Photo fixe tant que la vidéo n'est pas prête** (ou si elle échoue à se charger, ou si l'utilisateur a réduit les animations).
- **Lecture** : muette, en boucle, sans contrôles ; **mise en pause** quand l'écran n'est plus affiché, quand l'app passe en arrière-plan ou quand le hero est sorti de l'écran.
- La vidéo suit la parallaxe de la photo (elle est dans le même cadre).
- Android : `surfaceType="textureView"` (suit correctement le défilement).
- **Remplace la séquence ±8°** de `docs/SHOWROOM.md` : si la vidéo est branchée, elle est prioritaire.

## Limites connues
- La vidéo est **opaque** (H.264 n'a pas de transparence) : son décor est une copie de la photo sans voiture. Si le hero change (nouvelle photo), il faut refaire le plan sans voiture et la vidéo.
- Le fond de la vidéo et la photo sont superposés sans transition : la couleur est calée en BT.709, mais une très légère différence de compression reste possible.
- Licence et source du modèle 3D : à documenter avant publication.
