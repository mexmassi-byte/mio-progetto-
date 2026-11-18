#!/usr/bin/env bash
# Encode rendered PNG frames into the final MP4 with a light cinematic finish:
# soft bloom, gentle vignette, fine film grain (also prevents banding in the
# dark gradients), fade in/out, BT.709 colour, H.264 High profile.
#
#   render/encode.sh <frames_dir> <out.mp4> [crf=17] [start_frame=0] [fades=1]
set -euo pipefail
IN="$1"; OUT="$2"; CRF="${3:-17}"; START="${4:-0}"; FADES="${5:-1}"
FPS=60
FIRST=$(printf "%s/f_%05d.png" "$IN" "$START")
read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$FIRST" | tr 'x' ' ')
N=$(ls "$IN"/f_*.png | wc -l)
DUR=$(python3 -c "print($N/$FPS)")
FADE=""
if [ "$FADES" = "1" ]; then
  FADE=",fade=t=in:st=0:d=1.3,fade=t=out:st=$(python3 -c "print(round($N/$FPS-1.7,3))"):d=1.65"
fi
QW=$((W / 4)); QH=$((H / 4))
ffmpeg -y -hide_banner -loglevel warning -stats \
  -framerate $FPS -start_number "$START" -i "$IN/f_%05d.png" \
  -filter_complex "
    [0:v]format=gbrp,split=2[base][g];
    [g]scale=${QW}:${QH}:flags=area,
       lutrgb=r='clip((val-118)*1.7,0,255)':g='clip((val-118)*1.7,0,255)':b='clip((val-118)*1.7,0,255)',
       gblur=sigma=9:steps=3,
       scale=${W}:${H}:flags=bicubic[bloom];
    [base][bloom]blend=all_mode=screen:all_opacity=0.24,
       vignette=angle=0.56:mode=forward:eval=init${FADE},
       scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,
       noise=c0s=3:c0f=t+u[v]" \
  -map "[v]" -r $FPS \
  -c:v libx264 -preset slow -crf "$CRF" -tune film -profile:v high -level 5.1 \
  -x264-params "aq-mode=3:aq-strength=0.85:keyint=120:min-keyint=60" \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -movflags +faststart -an "$OUT"
echo "encoded $N frames (${DUR}s, ${W}x${H}) -> $OUT ($(du -h "$OUT" | cut -f1))"
