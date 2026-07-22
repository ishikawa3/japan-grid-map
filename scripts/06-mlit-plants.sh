#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 国土数値情報 P03（発電施設）を取り込み、OSM由来の plant データを補完する。
#
# 手順:
#   1. https://nlftp.mlit.go.jp/ksj/ から P03（発電施設）の都道府県別 shp を取得し、
#      data/raw/mlit/P03/ 以下に展開しておく（利用約款への同意が必要なため自動取得はしない）
#   2. 本スクリプトを実行する
#
# ライセンス: 国土数値情報のデータは出典・利用条件がデータセットごとに異なる。
# P03 を使う場合は README とアプリのクレジット表記に
# 「国土数値情報（国土交通省）」の出典を明記すること。
# 利用約款: https://nlftp.mlit.go.jp/ksj/other/agreement.html

SRC_DIR=data/raw/mlit/P03
OUT=data/interim/plants_mlit.geojsonseq

if [[ ! -d "$SRC_DIR" ]]; then
  echo "$SRC_DIR が見つかりません。国土数値情報 P03 のシェープファイルを配置してください" >&2
  echo "取得元: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P03-v3_1.html" >&2
  exit 1
fi

mkdir -p data/interim
rm -f "$OUT"

shp_count=0
for shp in "$SRC_DIR"/*.shp; do
  [[ -e "$shp" ]] || continue
  shp_count=$((shp_count + 1))
  ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 -update -append "$OUT" "$shp"
done

if (( shp_count == 0 )); then
  echo "$SRC_DIR に .shp が見つかりません" >&2
  exit 1
fi

count=$(wc -l < "$OUT")
echo "完了: $OUT ($count 件, $shp_count ファイルから統合)"
echo "発電施設種別コードの人間可読ラベルへのマッピングは scripts/lib/mlit-plant-types.ts を参照・拡張すること"
