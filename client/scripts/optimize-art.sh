#!/usr/bin/env bash
# Converts raster art in public/art to WebP with sizes that match how each file
# is drawn. The PNG or JPEG is copied into the internal art library first, then
# removed from the client so the game bundle stays small. If that library is
# not on disk, the source stays put. Files already in WebP are left alone.
# Needs cwebp (brew install webp).
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
archive="$(cd "$script_dir/../../../deepmark-internal/docs/art/library/masters" 2>/dev/null && pwd || true)"
cd "$script_dir/../public/art"

keep() {
  local f="$1"
  if [ -z "$archive" ]; then
    echo "leaving $f in the client: deepmark-internal art library is not checked out" >&2
    return 0
  fi
  if [ ! -e "$archive/$f" ]; then
    cp "$f" "$archive/$f"
  elif ! cmp -s "$f" "$archive/$f"; then
    local stamp alt n
    stamp="$(date +%Y%m%d)"
    alt="$archive/${f%.*}-$stamp.${f##*.}"
    n=2
    while [ -e "$alt" ]; do
      alt="$archive/${f%.*}-$stamp-$n.${f##*.}"
      n=$((n + 1))
    done
    cp "$f" "$alt"
  fi
  rm "$f"
}

convert() { # file, quality, max-width
  local f="$1" q="$2" w="$3" out="${1%.*}.webp"
  local width; width="$(sips -g pixelWidth "$f" | awk '/pixelWidth/ {print $2}')"
  local resize=(); [ "$width" -gt "$w" ] && resize=(-resize "$w" 0)
  cwebp -quiet -q "$q" -alpha_q 90 -m 6 ${resize[@]+"${resize[@]}"} "$f" -o "$out"
  keep "$f"
}

for f in *.png *.jpg; do
  [ -e "$f" ] || continue
  case "$f" in
    logo-lockup.png)                       convert "$f" 90 1100 ;;
    title-key-art.jpg)                     convert "$f" 78 1920 ;;
    boss-intro.jpg|victory-bg.jpg|vault-bg.jpg|title.jpg) convert "$f" 78 1600 ;;
    share-card-bg.jpg)                     convert "$f" 80 1200 ;;
    floor*.jpg|wall*.jpg|stairs*.jpg)      convert "$f" 80 1024 ;;
    plumb-blade.png|reaver-hook.png|bulwark-pike.png|oil-flask.png|keen-eye.png|stone-heart.png|relic-*.png) convert "$f" 88 256 ;;
    *.png)                                 convert "$f" 86 384 ;;
  esac
done
du -sh .
