#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for cmd in curl osmium tippecanoe ogr2ogr; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "必要なコマンドが見つかりません: $cmd" >&2
    echo "  macOS: brew install osmium-tool tippecanoe gdal curl" >&2
    echo "  Ubuntu: sudo apt install osmium-tool tippecanoe gdal-bin curl" >&2
    exit 1
  fi
done

DEST=data/raw/japan-latest.osm.pbf
URL=https://download.geofabrik.de/asia/japan-latest.osm.pbf

mkdir -p data/raw

if [[ -f "$DEST" ]]; then
  age_sec=$(( $(date +%s) - $(stat -c %Y "$DEST" 2>/dev/null || stat -f %m "$DEST") ))
  if (( age_sec < 86400 )); then
    echo "既存の $DEST は24時間以内に取得済みのため再取得しません（$((age_sec / 3600))時間前）"
    exit 0
  fi
fi

echo "ダウンロード中: $URL"
curl -L --continue-at - --fail -o "$DEST" "$URL"
echo "完了: $DEST ($(du -h "$DEST" | cut -f1))"
