# japan-grid-map

日本全国の送電線・変電所・発電所を、ズーム4〜14でシームレスに表示する静的Webアプリ。
PMTiles + MapLibre GL JS を使い、サーバー不要（静的ホスティングのみ）で動作する。

## 現在の状態

- リポジトリ構成・データパイプラインスクリプト・フロントエンドは一式実装済み
- 実データ（`japan-latest.osm.pbf` 約2GB）のダウンロードと osmium/tippecanoe による本番タイル生成は未実施
- フロントエンドは関東近郊を模した**架空のサンプルデータ**（`data/sample/`, 実在の系統とは一致しない）で動作確認済み

本番データを生成してデプロイするには [クイックスタート](#クイックスタート) の `make data` 以降を実行すること。

## 構成

- `scripts/` — OSM抽出 → 正規化 → タイル化 → GitHub Releasesへのアップロード
- `scripts/lib/voltage.ts` — 電圧パース・電圧クラス分けの唯一のソース（`web/` からも参照）
- `web/` — Vite + React + TypeScript + MapLibre GL JS フロントエンド
- `data/` — パイプラインの中間・出力物（`data/sample/` 以外は Git 管理外）

詳細は [CLAUDE.md](./CLAUDE.md) を参照。

## 配信方式

| 対象 | 配信先 |
|---|---|
| フロントエンド（`web/`） | GitHub Pages（`.github/workflows/deploy.yml` で自動デプロイ） |
| タイル（`grid.pmtiles`） | GitHub Releases のアセット（Range Request対応、1ファイル2GBまで、無料） |

GitHub は1ファイル100MBのハード制限があり、想定サイズ（〜150MB）の `grid.pmtiles` をリポジトリや
Pages に直接置くことはできないため、Releases アセットとして配布する構成にしている。

## クイックスタート

```bash
pnpm install

# 電圧パーサ等のユニットテスト
pnpm test

# フロントエンド開発サーバー（同梱のサンプルタイルで動作確認）
make dev

# --- 本番データパイプライン（要 osmium-tool, tippecanoe, gdal-bin, 数GBのディスクと数時間） ---
make data        # download → filter → normalize → tile
make upload       # grid.pmtiles を GitHub Releases にアップロード（要 gh CLI）
# web/.env に VITE_PMTILES_URL=<Releaseのダウンロード先URL> を設定して make build
```

必要なツール:

```bash
# Ubuntu
sudo apt install osmium-tool tippecanoe gdal-bin
# macOS
brew install osmium-tool tippecanoe gdal
```

## 出典・クレジット

- 送電網・変電所・発電所データ: [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors（ODbL）
- 背景地図: 地理院タイル（国土地理院）
- 発電施設データ（Phase 4, 任意）: 国土数値情報 P03（国土交通省）を統合する場合、
  [利用約款](https://nlftp.mlit.go.jp/ksj/other/agreement.html) に従いクレジット表記が必要
