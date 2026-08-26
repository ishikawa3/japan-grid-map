.PHONY: data download filter normalize tile search-index upload sample dev build test clean

# --- 本番データパイプライン（初回2-3時間、GB単位のダウンロード） ---

data: download filter normalize tile

download:
	bash scripts/01-download.sh

filter:
	bash scripts/02-filter.sh

normalize:
	pnpm exec tsx scripts/03-normalize.ts

tile:
	bash scripts/04-tile.sh

# タイルから施設名の検索インデックスを作り直す（make tile 内でも自動実行される）
search-index:
	pnpm exec tsx scripts/07-search-index.ts

upload:
	bash scripts/05-upload.sh

# --- サンプルデータ（軽量・動作確認用） ---

sample:
	pnpm exec tsx scripts/sample/generate-sample.ts
	bash scripts/sample/tile-sample.sh

# --- フロントエンド ---

dev:
	pnpm --filter web dev

build:
	pnpm --filter web build

# --- 共通 ---

test:
	pnpm test

clean:
	rm -rf data/raw/* data/interim/* data/dist/*
