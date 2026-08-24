#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

for f in data/interim/lines.geojsonseq data/interim/nodes.geojsonseq data/interim/towers.geojsonseq data/interim/generators.geojsonseq; do
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
  # power=generator（個別の発電設備）は全国で1万件弱と nodes(substation/plant)より
  # 少ないが局所的に密集しうるため、nodesよりやや高いズームから表示する
  -L'{"file":"data/interim/generators.geojsonseq","layer":"generators","minzoom":7}'
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

# GitHub Releases のアセットは Access-Control-Allow-Origin を返さないため、
# pmtiles の Range Request が別オリジン(GitHub Pages)からの fetch() で CORS ブロックされる。
# そのため web/public/tiles/ に直接コミットし、Pages と同一オリジンで配信する
# (git の1ファイル100MB制限に収まる場合のみ)。
GIT_LIMIT=$((95 * 1024 * 1024))
WEB_TILE=web/public/tiles/grid.pmtiles
if (( size_bytes < GIT_LIMIT )); then
  cp "$OUT" "$WEB_TILE"
  echo "コピー完了: $WEB_TILE ($size) — git commit してデプロイに含めてください"
else
  echo "警告: $size_bytes バイトは git の100MB制限に近いため $WEB_TILE への自動コピーをスキップしました。" >&2
  echo "  CORS対応のホスティング（raw.githubusercontent.com 経由の別ブランチ配信や Cloudflare R2 等）を検討してください（GitHub Releases はCORS非対応のため不可）" >&2
fi

echo "" >> docs/tile-sizes.md
echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> docs/tile-sizes.md
echo '```' >> docs/tile-sizes.md
pmtiles show "$OUT" >> docs/tile-sizes.md 2>&1 || echo "(pmtiles CLI 未インストール: npm i -g pmtiles で導入可能)" >> docs/tile-sizes.md
echo '```' >> docs/tile-sizes.md
echo "サイズ: $size" >> docs/tile-sizes.md

echo "docs/tile-sizes.md に記録しました"
