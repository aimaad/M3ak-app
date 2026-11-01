#!/bin/sh
# Encode les images du plateau tournant en MP4 de boucle pour le hero de M3AK.
#
# Usage : encode_video.sh FRAMES_DIR OUTPUT_BASENAME [FPS] [PLATE_IMAGE]
#   FRAMES_DIR   dossier de frame_0000.png … (RGBA, voiture + ombre sur fond transparent, rendu par render_turntable.py)
#   OUTPUT_BASENAME  chemin sans extension ; produit .mp4 et -poster.png
#   FPS          images/seconde (défaut 30)
#   PLATE_IMAGE  photo du hero SANS voiture (hero-no-car.jpg) sur laquelle poser le rendu. Sans elle : fond uni #171126.
#
# Variables d'environnement :
#   CROP="x,y,w,h"  zone de la photo reprise par la vidéo, en fractions de la photo (défaut 0.18,0.28,0.82,0.5 : doit
#                   correspondre à TURNTABLE_BOX dans src/features/dashboard/turntable/turntable-assets.ts)
#   CRF=22          qualité (plus petit = plus net et plus lourd)
#   ALPHA=1         produit aussi un WebM VP9 transparent (inutile dans l'app : React Native ne lit pas l'alpha)
#
# La vidéo est OPAQUE (H.264 n'a pas d'alpha) : elle contient le décor du hero, ce qui la fait se confondre avec la photo.
set -eu
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 FRAMES_DIR OUTPUT_BASENAME [FPS] [PLATE_IMAGE]" >&2
  exit 2
fi
FRAMES=$1
OUT=$2
FPS=${3:-30}
PLATE=${4:-}
CROP=${CROP:-0.18,0.28,0.82,0.5}
CRF=${CRF:-22}
command -v ffmpeg >/dev/null 2>&1 || { echo 'ffmpeg requis' >&2; exit 1; }
[ -f "$FRAMES/frame_0000.png" ] || { echo "Aucune image frame_0000.png dans $FRAMES" >&2; exit 1; }

# Dimensions des images rendues (doivent être paires pour H.264).
SIZE=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$FRAMES/frame_0000.png")
W=${SIZE%x*}
H=${SIZE#*x}
[ $((W % 2)) -eq 0 ] && [ $((H % 2)) -eq 0 ] || { echo "Dimensions impaires ($SIZE) : H.264 exige des dimensions paires" >&2; exit 1; }

CX=${CROP%%,*}; REST=${CROP#*,}
CY=${REST%%,*}; REST=${REST#*,}
CW=${REST%%,*}; CH=${REST#*,}

# Colorimétrie : tout est converti en BT.709 « limited » et balisé comme tel, pour que le décor de la vidéo ait exactement la
# couleur de la photo qui l'entoure (sinon un rectangle légèrement différent serait visible).
TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
FINISH="scale=${W}:${H}:out_color_matrix=bt709:out_range=tv,format=yuv420p"

if [ -n "$PLATE" ]; then
  [ -f "$PLATE" ] || { echo "Photo introuvable : $PLATE" >&2; exit 1; }
  FILTER="[0:v]crop=iw*${CW}:ih*${CH}:iw*${CX}:ih*${CY},scale=${W}:${H}:flags=lanczos,format=rgba[bg];[1:v]format=rgba[fg];[bg][fg]overlay=shortest=1:format=auto,${FINISH}"
  INPUTS="-loop 1 -framerate $FPS -i $PLATE -framerate $FPS -i $FRAMES/frame_%04d.png"
else
  FILTER="[0:v]format=rgba[bg];[1:v]format=rgba[fg];[bg][fg]overlay=shortest=1:format=auto,${FINISH}"
  INPUTS="-f lavfi -i color=c=0x171126:s=${W}x${H}:r=$FPS -framerate $FPS -i $FRAMES/frame_%04d.png"
fi

# MP4 : H.264 High, sans audio, image clé chaque seconde, démarrage rapide (faststart). Boucle sans coupure : la dernière image
# rendue précède la première (angle = 2π·i/N), la lecture en boucle repart donc sans saut.
# shellcheck disable=SC2086
ffmpeg -y -v error $INPUTS -filter_complex "$FILTER" -c:v libx264 -profile:v high -level 4.0 -crf "$CRF" -preset slow \
  -g "$FPS" -keyint_min "$FPS" -sc_threshold 0 $TAGS -an -movflags +faststart "$OUT.mp4"

# Image fixe de secours (poster) : la première image composée.
# shellcheck disable=SC2086
ffmpeg -y -v error $INPUTS -filter_complex "$FILTER" -frames:v 1 "$OUT-poster.png"

if [ "${ALPHA:-0}" = "1" ]; then
  ffmpeg -y -v error -framerate "$FPS" -i "$FRAMES/frame_%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 30 "$OUT-alpha.webm"
fi

BYTES=$(wc -c < "$OUT.mp4")
echo "Créé : $OUT.mp4 (${W}x${H}, ${FPS} i/s, $((BYTES / 1024)) Ko) et $OUT-poster.png"
if [ "$BYTES" -gt 2621440 ]; then
  echo "ATTENTION : plus de 2,5 Mo. Relancer avec CRF=26 ou réduire les dimensions / la durée." >&2
fi
