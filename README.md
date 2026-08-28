# japan-grid-map

日本全国の送電線・変電所・発電所を、ズーム4〜14でシームレスに表示する静的Webアプリ。
PMTiles + MapLibre GL JS を使い、サーバー不要（静的ホスティングのみ）で動作する。

## 現在の状態

- リポジトリ構成・データパイプラインスクリプト・フロントエンドは一式実装済み
- 本番データ（`japan-latest.osm.pbf` から抽出、lines 36,817 / nodes 50,984 / towers 257,833 /
  generators 8,750）を生成済みで、GitHub Pages で公開中: https://ishikawa3.github.io/japan-grid-map/
- タイル本体（`grid.pmtiles`、35MB）は `web/public/tiles/` にコミットして配信している（後述）

再生成するには [クイックスタート](#クイックスタート) の `make data` を実行すること。

## 主な機能

- 送電線を電圧クラス（500kV以上 / 220–275kV / 110–187kV / 60–77kV / それ未満）で色分け表示
- 変電所・発電所・個別発電設備・鉄塔のレイヤ別表示切り替え
- **施設名での検索**（約5,300件の変電所・発電所・発電設備を名前で引ける）
- 表示状態のURL同期（ズーム・位置・フィルタを含めた共有が可能）
- PWA対応（ホーム画面に追加でき、アプリシェルはオフラインでも起動する。
  新バージョン検知時は更新を promptし、勝手にリロードしない）
- [WebMCP](https://github.com/webmachinelearning/webmcp) 対応（AIエージェントから地図の移動・
  絞り込み・施設検索を実行できる。対応ブラウザのみ）

## 構成

- `scripts/` — OSM抽出 → 正規化 → タイル化 → `web/public/tiles/` へのコピー
- `scripts/lib/voltage.ts` — 電圧パース・電圧クラス分けの唯一のソース（`web/` からも参照）
- `scripts/07-search-index.ts` — タイルから施設名の検索インデックスを生成
- `scripts/assets/` — favicon・OGP画像・インストールUI用スクリーンショットの生成スクリプト
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
make data        # download → filter → normalize → tile
                 # tile が web/public/tiles/ へのコピー、data-meta.json の更新、
                 # 検索インデックスの再生成まで行う
git add web/public/tiles/grid.pmtiles web/public/search-index.json \
        web/src/data-meta.json docs/tile-sizes.md && git commit -m "..." 
```

必要なツール:

```bash
# Ubuntu
sudo apt install osmium-tool tippecanoe gdal-bin
# macOS
brew install osmium-tool tippecanoe gdal
```

## ライセンス

- **ソースコード**: MIT License（[LICENSE](./LICENSE)）
- **地図データ** (`web/public/tiles/grid.pmtiles`): MIT ではなく
  **[ODbL 1.0](https://opendatacommons.org/licenses/odbl/)**。
  © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors。
  再配布・派生データの作成にあたっては、表示義務と継承（share-alike）条件に従うこと
- **背景地図**: [地理院タイル](https://maps.gsi.go.jp/development/ichiran.html)（国土地理院）。
  同サイトの利用規約に従う

## 免責事項

本サイトは OpenStreetMap の有志による調査データをもとにした非公式の可視化であり、電力会社が公表する
正式な設備情報ではありません。網羅性・正確性・最新性は保証されず、実在しない設備の表示や実在する設備の
欠落が含まれます。事業判断・工事・緊急対応など正確性が求められる用途には使用しないでください。
