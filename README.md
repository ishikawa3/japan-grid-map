# japan-grid-map

日本全国の送電線・変電所・発電所を、ズーム4〜14でシームレスに表示する静的Webアプリ。
PMTiles + MapLibre GL JS を使い、サーバー不要（静的ホスティングのみ）で動作する。

## 現在の状態

- リポジトリ構成・データパイプラインスクリプト・フロントエンドは一式実装済み
- 本番データ（`japan-latest.osm.pbf` から抽出、lines 36,817 / nodes 50,984 / towers 257,833）を生成済みで、
  GitHub Pages で公開中: https://ishikawa3.github.io/japan-grid-map/
- タイル本体（`grid.pmtiles`、34MB）は `web/public/tiles/` にコミットして配信している（後述）

再生成するには [クイックスタート](#クイックスタート) の `make data` を実行すること。

## 構成

- `scripts/` — OSM抽出 → 正規化 → タイル化 → `web/public/tiles/` へのコピー
- `scripts/lib/voltage.ts` — 電圧パース・電圧クラス分けの唯一のソース（`web/` からも参照）
- `web/` — Vite + React + TypeScript + MapLibre GL JS フロントエンド
- `data/` — パイプラインの中間・出力物（`data/sample/` 以外は Git 管理外）

詳細は [CLAUDE.md](./CLAUDE.md) を参照。

## 配信方式

| 対象 | 配信先 |
|---|---|
| フロントエンド（`web/`） | GitHub Pages（`.github/workflows/deploy.yml` で自動デプロイ） |
| タイル（`grid.pmtiles`） | `web/public/tiles/grid.pmtiles` としてリポジトリに直接コミットし、Pages と同一オリジンで配信 |

タイルは当初 GitHub Releases のアセットとして配布する設計だったが、Releases のアセットは
`Access-Control-Allow-Origin` を返さないため、pmtiles の Range Request が別オリジン（GitHub Pages）
からの `fetch()` で CORS ブロックされ、地図が表示されない問題が判明した。本番タイルは34MBと
gitの1ファイル100MB制限に十分収まるため、リポジトリに直接コミットする方式に変更している。
タイルが将来100MBに近づく場合は CORS 対応のホスト（`raw.githubusercontent.com` 経由の別ブランチ配信、
Cloudflare R2 等）への切り替えを検討すること。

## クイックスタート

```bash
pnpm install

# 電圧パーサ等のユニットテスト
pnpm test

# フロントエンド開発サーバー（同梱のタイルで動作確認）
make dev

# --- 本番データパイプライン再生成（要 osmium-tool, tippecanoe, gdal-bin, 数GBのディスクと数時間） ---
make data        # download → filter → normalize → tile（tileが web/public/tiles/ へ自動コピー）
git add web/public/tiles/grid.pmtiles docs/tile-sizes.md && git commit -m "..." # 生成物をコミット
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
