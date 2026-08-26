# japan-grid-map 作業メモ

日本全国の送電線・変電所・発電所を PMTiles + MapLibre GL JS でシームレスに表示する静的Webアプリ。

## 構成

```
scripts/         データパイプライン（OSM抽出 → 正規化 → タイル化 → 配布）
scripts/lib/voltage.ts   電圧パース・クラス分けの唯一のソース（web からも import）
scripts/07-search-index.ts  タイルから施設名検索インデックスを生成
scripts/sample/   軽量なサンプルデータ生成・タイル化（本番pbfなしで動作確認用）
scripts/assets/   favicon/OGP画像の生成スクリプト（要 playwright、生成物はコミット）
web/              Vite + React + TypeScript + MapLibre GL JS フロントエンド
web/src/data-meta.json  UIに出すデータ鮮度と件数（04-tile.sh が自動更新）
data/             パイプラインの中間・出力物。data/sample/ 以外は .gitignore 対象
docs/tile-sizes.md  tippecanoe オプション変更時のタイルサイズ記録
```

## コマンド

```
make data     # 本番パイプライン全実行（初回2-3時間、japan-latest.osm.pbf 約2GBを取得）
make tile     # タイル再生成のみ
make search-index  # タイルから施設名の検索インデックスを再生成（make tile 内でも自動実行）
make sample   # 軽量サンプルデータ生成 + サンプルpmtiles作成（本番pbf不要、数秒で完了）
make dev      # web/ の開発サーバー
make build    # web/ の本番ビルド
make upload   # data/dist/grid.pmtiles を GitHub Releases にアップロード（※現在の配信経路では未使用。バックアップ用途のみ）
make test     # 電圧パーサ等のユニットテスト
```

## 配信方式

- フロントエンド: GitHub Pages（`web/` を `.github/workflows/deploy.yml` でビルド・デプロイ）
- タイル (`grid.pmtiles`): `web/public/tiles/grid.pmtiles` として **リポジトリに直接コミット**し、
  Pages と同一オリジンで配信する（`scripts/04-tile.sh` が data/dist/ から自動コピーする）。
  本番タイルは現状34MB程度でgitの1ファイル100MB制限に十分収まっている。
  - **GitHub Releases のアセットは使わないこと**: Access-Control-Allow-Origin を返さないため、
    pmtiles の Range Request が別オリジン(GitHub Pages)からの `fetch()` で CORS ブロックされ、
    地図にタイルが一切表示されない（過去に本番投入して発覚した既知の罠）。
  - 将来タイルが100MBに近づき同一リポジトリへのコミットが困難になった場合は、
    CORS対応のホスト（`raw.githubusercontent.com` 経由での別ブランチ配信、Cloudflare R2 等）に
    切り替えること。`scripts/05-upload.sh`（Releasesアップロード）は現在デフォルトの配信経路では
    使われていない。
  - フロント側のタイルURLは `web/.env` の `VITE_PMTILES_URL` で上書き可能（未設定時は同梱の
    `web/public/tiles/grid.pmtiles` を使う）。

## 原則

- data/ 配下（data/sample/ を除く）はコミットしない。ただし `web/public/tiles/grid.pmtiles`
  （配信用に data/dist/ からコピーしたもの）は例外としてコミットする
- 電圧パースのロジックは `scripts/lib/voltage.ts` の一箇所のみ。フロントもここから import する
- tippecanoe のオプションを変えたら必ず `pmtiles show` でサイズを記録し、`docs/tile-sizes.md` に追記する
- OSMタグの解釈を変えたら normalize のテストを先に書く
- `power=tower`（鉄塔）は全国で数十万件あるため、ズーム13以上でのみ表示する別レイヤ（towers）に分離する
- `power=generator`（個別発電設備。太陽光パネル群・風車1基・小水力施設など、`power=plant`より粒度が細かい）
  は `generators` レイヤとしてズーム7以上で表示する。全国約8,750件
- 低ズームでの間引きは tippecanoe の `--drop-densest-as-needed` に任せきりにせず、電圧クラスによるフィルタ（フロント側 `setFilter`）で意味のある間引きをする
- 検索インデックスは**必ず最大ズーム(z14)から**抽出する。低ズームのタイルは間引き済みで、
  実測で z10:4,692 → z12:6,674 → z14:10,001 件と取りこぼす（`--verify` で確認できる）
- `index.html` 内のアセット参照はリポジトリ名を含めず `/favicon.svg` のように書く。
  Vite が `base` を前置するため、ハードコードすると `base` 変更時に壊れる
- Service Worker はアプリシェルのみキャッシュし、`tiles/` と Range Request は対象外にする
  （35MBのバイナリでストレージを圧迫し、206レスポンスは Cache API に put できない）

## 現在の状態（このリポジトリを引き継ぐ場合）

本番データ生成・デプロイは完了済み（2026-08-24）。`make data` で japan-latest.osm.pbf から
lines 36,817 / nodes 50,984 / towers 257,833 / generators 8,750 を抽出し、`grid.pmtiles`（35MB）を
生成、`web/public/tiles/grid.pmtiles` にコミットして GitHub Pages で公開している。
再生成する場合は `make data` を実行するだけでよい（`scripts/04-tile.sh` が
`web/public/tiles/grid.pmtiles` への自動コピーまで行う。git commit は別途必要）。

MLIT国土数値情報P03（発電施設）の統合は見送り済み: 最新版が2013年度で止まっており利用規約も
非商用限定のため。`scripts/06-mlit-plants.sh` は未使用のまま残っているが、発電種別ごとに9つの
シェープファイルが日本語サブディレクトリ（Shift-JIS）に分かれている点は未対応（現状のフラット
`*.shp` globでは動かない）。将来使うなら要修正。

### 過去のバグ

1. `scripts/03-normalize.ts` は osmium export の出力（RFC 8142 GeoJSON Text Sequences、各行先頭に
   RS制御文字 0x1E）を素の `line.trim()` で読んでいたため、実データ投入時に全件が `skipped` に
   なっていた（サンプルデータにはRS文字がなく発覚しなかった）。修正済み。

2. `writeNode` が Polygon/MultiPolygon しか代表点化しておらず、osmium がエリアとして扱わなかった
   `power=substation` の way が **LineString のまま nodes レイヤに入っていた**。circle レイヤは
   頂点ごとに円を描くため、変電所が「円の塊」に見え、検索インデックスからも漏れていた。
   normalize 側は修正済み（Point 以外はすべて代表点化する）だが、**現在配信中のタイルは修正前の
   もの**なので LineString が残っている。フロントは `geometry-type` で振り分け、点は circle、
   外形線は line レイヤ（`nodes-*-outline`）で描いて両対応にしてある。
   次回 `make data` で再生成すれば outline レイヤは自然に空になる。

## SEO / PWA / WebMCP

- `web/index.html` に description・OGP・Twitter Card・canonical・JSON-LD・`<noscript>` を用意。
  `maximum-scale` は指定しない（ピンチズーム禁止はアクセシビリティを損なうため）
- `web/public/` に robots.txt / sitemap.xml / manifest.webmanifest / favicon / アイコン / og-image.png。
  OGP画像は実際の地図から `scripts/assets/generate-og-image.cjs` で生成する
- WebMCP (`web/src/lib/webmcp.ts`): 地図の移動・電圧フィルタ・レイヤ切替・施設検索を
  AIエージェント向けツールとして公開。仕様が `navigator.modelContext` → `document.modelContext` へ
  移行中のため両対応にし、未対応ブラウザでは何もしない（機能検出のみ）。
  2026-08時点で W3C の Draft Community Group Report であり標準化トラック未到達。Chrome は
  Origin Trial（本番利用にはトークン登録が必要）、Firefox/Safari 未実装
