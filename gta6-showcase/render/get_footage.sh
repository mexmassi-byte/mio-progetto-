#!/usr/bin/env bash
# Download the royalty-free night-city clips used by the motion graphic, then cut them with
# render/prep_footage.sh. Pexels: Pexels License; Mixkit: Mixkit Stock Video Free License
# (free to use, no attribution required — credited in the README anyway).
#
#   render/get_footage.sh <download_dir> && render/prep_footage.sh <download_dir>
set -euo pipefail
DIR="$1"; mkdir -p "$DIR"
get() { curl -fsSL --retry 3 -m 600 -o "$DIR/$2" "$1" && echo "ok $2"; }
get https://www.pexels.com/download/video/6345205/  px_6345205_city_night.mp4
get https://www.pexels.com/download/video/19109600/ px_19109600_miami_drone.mp4
get https://www.pexels.com/download/video/19109604/ px_19109604_drone_of_miami.mp4
get https://www.pexels.com/download/video/8576666/  px_8576666_port_timelapse.mp4
get https://www.pexels.com/download/video/40183132/ px_40183132_boulevard_night.mp4
get https://assets.mixkit.co/videos/42042/42042-720.mp4 mx_42042_bridge_hyperlapse.mp4
get https://assets.mixkit.co/videos/12028/12028-720.mp4 mx_12028_night_lights_miami.mp4
get https://assets.mixkit.co/videos/42034/42034-720.mp4 mx_42034_driving_city_night.mp4
