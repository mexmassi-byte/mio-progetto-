#!/usr/bin/env bash
# Cut royalty-free clips (Pexels License / Mixkit Free License) into graded 1080x1920 JPEG
# sequences for the motion graphic.  Usage: render/prep_footage.sh <download_dir>
set -euo pipefail
SRC="$1"; OUT="$(dirname "$0")/../footage"
mkdir -p "$OUT"
grade="eq=contrast=1.07:saturation=0.9:gamma=0.97,colorbalance=rs=0.02:bs=-0.02:rm=0.03:bm=-0.03:rh=0.04:gh=0.01:bh=-0.05"
# name  file  start  dur  crop-center-x (fraction of width)
while read -r name file start dur cx; do
  [ -z "$name" ] && continue
  mkdir -p "$OUT/$name"; rm -f "$OUT/$name"/*.jpg
  ffmpeg -nostdin -v error -y -ss "$start" -t "$dur" -i "$SRC/$file" \
    -vf "crop='min(iw,ih*9/16)':ih:'max(0,min(iw-min(iw,ih*9/16),iw*$cx-min(iw,ih*9/16)/2))':0,scale=1080:1920:flags=lanczos,$grade" \
    -q:v 3 "$OUT/$name/f_%04d.jpg"
  fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SRC/$file")
  echo "{\"fps\": $(python3 -c "print(round(eval('$fps'),4))"), \"frames\": $(ls "$OUT/$name" | wc -l)}" > "$OUT/$name/meta.json"
  echo "$name: $(cat "$OUT/$name/meta.json")"
done <<'LIST'
city     px_6345205_city_night.mp4          3.0  4.2  0.66
bridge   mx_42042_bridge_hyperlapse.mp4     2.0  3.2  0.50
boule    px_40183132_boulevard_night.mp4    1.0  3.2  0.50
port     px_8576666_port_timelapse.mp4      6.0  3.2  0.46
drone    px_19109600_miami_drone.mp4        4.0  4.4  0.78
drive    mx_42034_driving_city_night.mp4    0.4  3.0  0.50
lights   mx_12028_night_lights_miami.mp4    2.0  3.0  0.62
tower    px_19109604_drone_of_miami.mp4     12.0 3.0  0.84
LIST
# the same skyline as a landscape crop for the website's Launch Trailer card (1240 x 600 CSS px @2x)
mkdir -p "$OUT/card"; rm -f "$OUT/card"/*.jpg
ffmpeg -nostdin -v error -y -ss 3.0 -t 2.2 -i "$SRC/px_6345205_city_night.mp4" \
  -vf "crop=iw:'iw*600/1240':0:'(ih-iw*600/1240)*0.55',scale=2480:1200:flags=lanczos,$grade" -q:v 3 "$OUT/card/f_%04d.jpg"
echo "{\"fps\": 30.0, \"frames\": $(ls "$OUT/card" | wc -l)}" > "$OUT/card/meta.json"; echo "card: $(cat "$OUT/card/meta.json")"
