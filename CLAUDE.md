# japan-grid-map 作業メモ

日本全国の送電線・変電所・発電所を PMTiles + MapLibre GL JS でシームレスに表示する静的Webアプリ。

## 構成

```
scripts/         データパイプライン（OSM抽出 → 正規化 → タイル化 → 配布）
scripts/lib/voltage.ts  電圧パース・クラス分けの唯一のソース（web からも import）
scripts/sample/   軽量なサンプルデータ生成・タイル化（本番pbfなしで動作確認用）
web/              Vite + React + TypeScript + MapLibre GL JS フロントエンド
data/             パイプラインの中間・出力物。data/sample/ 以外は .gitignore 対象
docs/tile-sizes.md  tippecanoe オプション変更時のタイルサイズ記録
```

## コマンド

```
make data     # 本番パイプライン全実行（初回2-3時間、japan-latest.osm.pbf 約2GBを取得）
make tile     # タイル再生成のみ
make sample   # 軽量サンプルデータ生成 + サンプルpmtiles作成（本番pbf不要、数秒で完了）
make dev      # web/ の開発サーバー
make build    # web/ の本番ビルド
make upload   # data/dist/grid.pmtiles を GitHub Releases にアップロード
make test     # 電圧パーサ等のユニットテスト
```

## 配信方式

- フロントエンド: GitHub Pages（`web/` を `.github/workflows/deploy.yml` でビルド・デプロイ）
- タイル (`grid.pmtiles`): GitHub Releases のアセットとして配布（1ファイル2GBまで、Range Request対応、無料）。
  リポジトリへの直接コミットは禁止（GitHubの1ファイル100MB制限に抵触するため）。
- フロント側のタイルURLは `web/.env` の `VITE_PMTILES_URL` で切り替える（開発時はサンプル、本番はRelease URL）。

## 原則

- data/ 配下（data/sample/ を除く）はコミットしない
- 電圧パースのロジックは `scripts/lib/voltage.ts` の一箇所のみ。フロントもここから import する
- tippecanoe のオプションを変えたら必ず `pmtiles show` でサイズを記録し、`docs/tile-sizes.md` に追記する
- OSMタグの解釈を変えたら normalize のテストを先に書く
- `power=tower`（鉄塔）は全国で数十万件あるため、ズーム13以上でのみ表示する別レイヤ（towers）に分離する
- 低ズームでの間引きは tippecanoe の `--drop-densest-as-needed` に任せきりにせず、電圧クラスによるフィルタ（フロント側 `setFilter`）で意味のある間引きをする

## 現在の状態（このリポジトリを引き継ぐ場合）

本番の `japan-latest.osm.pbf` ダウンロードと osmium/tippecanoe の実行はまだ行っていない。
`make sample` で作った少数の架空/簡易サンプルデータ（東京近郊）でフロントエンドの動作確認のみ済んでいる。
本番データを生成するには `make data && make upload` を実行し、`web/.env` の `VITE_PMTILES_URL` を
Releases の実URLに切り替えること。
