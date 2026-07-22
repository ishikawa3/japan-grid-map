# タイルサイズ記録

`scripts/04-tile.sh`（本番）を実行するたびに、tippecanoe オプションとサイズをここに追記する運用。

## サンプルデータ (data/sample/grid.pmtiles)

- 生成コマンド: `make sample`
- サイズ: 44K（17 features: lines=7, nodes=6, towers=4）
- 本番の目標サイズ（150MB以下）とは無関係。動作確認用の参考値。

本番タイルの記録はここから下に追記されていく（`scripts/04-tile.sh` が自動追記）。
