#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

for f in data/sample/lines.geojsonseq data/sample/nodes.geojsonseq data/sample/towers.geojsonseq data/sample/generators.geojsonseq; do
  if [[ ! -f "$f" ]]; then
    echo "$f が見つかりません。先に scripts/sample/generate-sample.ts を実行してください" >&2
    exit 1
  fi
done

tippecanoe -o data/sample/grid.pmtiles --force \
  --name="Japan Power Grid (sample)" \
  --attribution="Sample data - not real grid topology" \
  -Z4 -z14 \
  -L'{"file":"data/sample/lines.geojsonseq","layer":"lines","minzoom":4}' \
  -L'{"file":"data/sample/nodes.geojsonseq","layer":"nodes","minzoom":4}' \
  -L'{"file":"data/sample/towers.geojsonseq","layer":"towers","minzoom":4}' \
  -L'{"file":"data/sample/generators.geojsonseq","layer":"generators","minzoom":4}'

echo "生成完了: data/sample/grid.pmtiles ($(du -h data/sample/grid.pmtiles | cut -f1))"
