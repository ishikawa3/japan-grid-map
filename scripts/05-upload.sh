#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# grid.pmtiles を GitHub Releases のアセットとしてアップロードする。
# 100MB超のファイルはリポジトリに直接コミットできないため、GitHub Releases
# （1ファイル2GBまで、Range Request対応、無料）を配布先として使う。
#
# 事前準備: gh CLI がインストール・認証済みであること（gh auth login）

FILE=data/dist/grid.pmtiles
TAG="${1:-tiles-$(date -u +%Y%m%d)}"
REPO="${GITHUB_REPOSITORY:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI が見つかりません。https://cli.github.com/ を参照してインストールしてください" >&2
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "$FILE が見つかりません。先に scripts/04-tile.sh を実行してください" >&2
  exit 1
fi

echo "リリース $TAG を作成/更新して $FILE をアップロードします"

if gh release view "$TAG" ${REPO:+-R "$REPO"} >/dev/null 2>&1; then
  gh release upload "$TAG" "$FILE" --clobber ${REPO:+-R "$REPO"}
else
  gh release create "$TAG" "$FILE" \
    --title "Tiles $TAG" \
    --notes "grid.pmtiles ($(du -h "$FILE" | cut -f1))" \
    ${REPO:+-R "$REPO"}
fi

echo "完了。web/.env の VITE_PMTILES_URL を Release アセットのURLに設定してください"
echo "例: https://github.com/<owner>/<repo>/releases/download/$TAG/grid.pmtiles"
