#!/bin/sh
set -eu
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 FRAMES_DIR OUTPUT_BASENAME [FPS]" >&2
  exit 2
fi
FRAMES=$1
OUT=$2
FPS=${3:-30}
command -v ffmpeg >/dev/null 2>&1 || { echo 'ffmpeg required' >&2; exit 1; }
[ -f "$FRAMES/frame_0000.png" ] || { echo 'No frames found' >&2; exit 1; }
# MP4 uses a dark backdrop; alpha cannot be retained in H.264.
ffmpeg -y -framerate "$FPS" -i "$FRAMES/frame_%04d.png" -filter_complex 'format=rgba,split[fg][bg];[bg]format=rgb24,drawbox=c=0x10101a:t=fill[base];[base][fg]overlay=shortest=1:format=auto,format=yuv420p' -c:v libx264 -crf 20 -preset medium -movflags +faststart "$OUT.mp4"
# VP9 alpha is browser-dependent; verify transparency in the target player.
ffmpeg -y -framerate "$FPS" -i "$FRAMES/frame_%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 -b:v 0 -crf 28 "$OUT-alpha.webm"
cp "$FRAMES/frame_0000.png" "$OUT-poster.png"
echo "Created $OUT.mp4, $OUT-alpha.webm and $OUT-poster.png"
