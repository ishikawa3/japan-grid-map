# タイルサイズ記録

`scripts/04-tile.sh`（本番）を実行するたびに、tippecanoe オプションとサイズをここに追記する運用。

## サンプルデータ (data/sample/grid.pmtiles)

- 生成コマンド: `make sample`
- サイズ: 44K（17 features: lines=7, nodes=6, towers=4）
- 本番の目標サイズ（150MB以下）とは無関係。動作確認用の参考値。

本番タイルの記録はここから下に追記されていく（`scripts/04-tile.sh` が自動追記）。

## 2026-08-24T16:08:34Z
```
scripts/04-tile.sh: line 48: pmtiles: command not found
(pmtiles CLI 未インストール: npm i -g pmtiles で導入可能)
```
サイズ:  34M

## 2026-08-24T16:09:46Z
```
pmtiles spec version: 3
tile type: mvt
bounds: (long: 123.011335, lat: 24.061636) (long: 145.770705, lat: 45.398544)
min zoom: 4
max zoom: 14
center: (long: 137.010498, lat: 35.092945)
center zoom: 14
addressed tiles count: 60508
tile entries count: 60508
tile contents count: 60508
clustered: true
internal compression: gzip
tile compression: gzip
type overlay
vector_layers <object, use --metadata to view full JSON metadata>
description Japan Power Grid
version 2
attribution © OpenStreetMap contributors
strategies <object, use --metadata to view full JSON metadata>
generator tippecanoe v2.79.0
generator_options tippecanoe -o data/dist/grid.pmtiles --force '--name=Japan Power Grid' '--attribution=© OpenStreetMap contributors' -Z4 -z14 --drop-densest-as-needed --extend-zooms-if-still-dropping '--simplification=4' '-L{"file":"data/interim/lines.geojsonseq","layer":"lines","minzoom":4}' '-L{"file":"data/interim/nodes.geojsonseq","layer":"nodes","minzoom":6}' '-L{"file":"data/interim/towers.geojsonseq","layer":"towers","minzoom":13}'
antimeridian_adjusted_bounds 123.011335,24.061636,145.770705,45.398544
tilestats <object, use --metadata to view full JSON metadata>
name Japan Power Grid
format pbf
```
サイズ:  34M

## 2026-08-24T16:49:13Z
```
pmtiles spec version: 3
tile type: mvt
bounds: (long: 123.011335, lat: 24.061636) (long: 145.804541, lat: 45.478038)
min zoom: 4
max zoom: 14
center: (long: 137.010498, lat: 35.092945)
center zoom: 14
addressed tiles count: 61674
tile entries count: 61674
tile contents count: 61674
clustered: true
internal compression: gzip
tile compression: gzip
vector_layers <object, use --metadata to view full JSON metadata>
tilestats <object, use --metadata to view full JSON metadata>
type overlay
description Japan Power Grid
attribution © OpenStreetMap contributors
generator tippecanoe v2.79.0
generator_options tippecanoe -o data/dist/grid.pmtiles --force '--name=Japan Power Grid' '--attribution=© OpenStreetMap contributors' -Z4 -z14 --drop-densest-as-needed --extend-zooms-if-still-dropping '--simplification=4' '-L{"file":"data/interim/lines.geojsonseq","layer":"lines","minzoom":4}' '-L{"file":"data/interim/nodes.geojsonseq","layer":"nodes","minzoom":6}' '-L{"file":"data/interim/generators.geojsonseq","layer":"generators","minzoom":7}' '-L{"file":"data/interim/towers.geojsonseq","layer":"towers","minzoom":13}'
antimeridian_adjusted_bounds 123.011335,24.061636,145.804541,45.478038
name Japan Power Grid
format pbf
version 2
strategies <object, use --metadata to view full JSON metadata>
```
サイズ:  35M
