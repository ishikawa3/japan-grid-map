#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=data/raw/japan-latest.osm.pbf
FILTERED=data/interim/power.osm.pbf
OUT=data/interim/power.geojsonseq

if [[ ! -f "$SRC" ]]; then
  echo "$SRC が見つかりません。先に scripts/01-download.sh を実行してください" >&2
  exit 1
fi

mkdir -p data/interim

echo "electrical タグでフィルタ中..."
osmium tags-filter "$SRC" \
  w/power=line,minor_line,cable,substation,plant \
  n/power=substation,plant,tower,portal,generator \
  r/power=plant,substation \
  -o "$FILTERED" --overwrite

echo "GeoJSONSeq へ export 中..."
osmium export "$FILTERED" \
  --geometry-types=point,linestring,polygon \
  --add-unique-id=type_id \
  -o "$OUT" -f geojsonseq --overwrite

lines=$(wc -l < "$OUT")
echo "完了: $OUT ($lines features)"

if (( lines < 100000 )); then
  echo "警告: feature 数が10万件未満です。全国データとして少なすぎる可能性があります（source pbf を確認してください）" >&2
fi
