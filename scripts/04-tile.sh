#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for f in data/interim/lines.geojsonseq data/interim/nodes.geojsonseq data/interim/towers.geojsonseq; do
  if [[ ! -f "$f" ]]; then
    echo "$f が見つかりません。先に scripts/03-normalize.ts を実行してください" >&2
    exit 1
  fi
done

mkdir -p data/dist docs

OUT=data/dist/grid.pmtiles

LAYERS=(
  -L'{"file":"data/interim/lines.geojsonseq","layer":"lines","minzoom":4}'
  -L'{"file":"data/interim/nodes.geojsonseq","layer":"nodes","minzoom":6}'
)

# 発電所データ（MLIT）があれば追加レイヤとして含める（Phase 4）
if [[ -f data/interim/plants_mlit.geojsonseq ]]; then
  LAYERS+=(-L'{"file":"data/interim/plants_mlit.geojsonseq","layer":"plants_mlit","minzoom":6}')
fi

LAYERS+=(-L'{"file":"data/interim/towers.geojsonseq","layer":"towers","minzoom":13}')

tippecanoe -o "$OUT" --force \
  --name="Japan Power Grid" \
  --attribution="© OpenStreetMap contributors" \
  -Z4 -z14 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --simplification=4 \
  "${LAYERS[@]}"

size=$(du -h "$OUT" | cut -f1)
size_bytes=$(stat -c %s "$OUT" 2>/dev/null || stat -f %z "$OUT")
echo "生成完了: $OUT ($size)"

if (( size_bytes > 150 * 1024 * 1024 )); then
  echo "警告: 150MBの目標サイズを超えています。towers の minzoom を上げるか --simplification を上げてください" >&2
fi

echo "" >> docs/tile-sizes.md
echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> docs/tile-sizes.md
echo '```' >> docs/tile-sizes.md
pmtiles show "$OUT" >> docs/tile-sizes.md 2>&1 || echo "(pmtiles CLI 未インストール: npm i -g pmtiles で導入可能)" >> docs/tile-sizes.md
echo '```' >> docs/tile-sizes.md
echo "サイズ: $size" >> docs/tile-sizes.md

echo "docs/tile-sizes.md に記録しました"
