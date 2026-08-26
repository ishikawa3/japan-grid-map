// grid.pmtiles から施設名の検索インデックス (web/public/search-index.json) を生成する。
//
// 入力を「配信中のタイルそのもの」にしているのは、中間生成物 (data/interim/*.geojsonseq) が
// .gitignore 対象で make data を回さない限り存在しないため。タイルさえあれば再生成できる。
//
// 注意: nodes レイヤには Point だけでなく LineString / Polygon が混在する。
// osmium export は power=substation の閉じた way をエリアとして扱わないことがあり、
// 03-normalize.ts が重心化していなかった分がそのまま線として残っているため。
// 検索インデックスでは種別を問わず代表点（座標のbbox中心）に落として扱う。
import { readFile, writeFile } from 'node:fs/promises';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles, type Source, type RangeResponse } from 'pmtiles';

const TILE_PATH = 'web/public/tiles/grid.pmtiles';
const OUT_PATH = 'web/public/search-index.json';

// 抽出は必ず最大ズームで行う。低ズームのタイルは --drop-densest-as-needed で地物が
// 間引かれており、件数が実測で z10:4,692 → z12:6,674 → z14:10,001 と増え続ける
// （= 低ズームでは取りこぼす）。最大ズームなら間引きがなく完全な集合が得られる。
// 検証は `pnpm exec tsx scripts/07-search-index.ts --verify` で隣接ズームと比較できる。
const ZOOM = Number(process.env.SEARCH_INDEX_ZOOM ?? 14);

// 日本全域（タイルの bounds に余裕を持たせた範囲）
const BBOX = { minLon: 122.0, maxLon: 154.0, minLat: 20.0, maxLat: 46.5 };

/** 種別: s=変電所, p=発電所, g=発電設備 */
type Kind = 's' | 'p' | 'g';

interface IndexEntry {
  n: string;
  t: Kind;
  /** 代表点の経度・緯度（小数4桁 ≒ 11m 精度） */
  lon: number;
  lat: number;
  /** 事業者（あれば） */
  o?: string;
}

/** タイル境界で分割された地物を id 単位でまとめるための作業用レコード */
interface Accum {
  n: string;
  t: Kind;
  o?: string;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/** ローカルファイルを pmtiles ライブラリに読ませるための Source 実装 */
class FileSource implements Source {
  constructor(private buf: Buffer) {}
  getKey() {
    return TILE_PATH;
  }
  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    return { data: new Uint8Array(this.buf.subarray(offset, offset + length)).buffer };
  }
}

const lonToTileX = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);

const latToTileY = (lat: number, z: number) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

async function buildIndex(pmtiles: PMTiles, zoom: number): Promise<Map<string, Accum>> {
  const xMin = lonToTileX(BBOX.minLon, zoom);
  const xMax = lonToTileX(BBOX.maxLon, zoom);
  const yMin = latToTileY(BBOX.maxLat, zoom);
  const yMax = latToTileY(BBOX.minLat, zoom);

  const acc = new Map<string, Accum>();
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      const tile = await pmtiles.getZxy(zoom, x, y);
      if (!tile?.data) continue;
      const vt = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
      collectLayer(vt, 'nodes', zoom, x, y, acc);
      collectLayer(vt, 'generators', zoom, x, y, acc);
    }
  }
  return acc;
}

function collectLayer(vt: VectorTile, layerName: string, z: number, x: number, y: number, acc: Map<string, Accum>) {
  const layer = vt.layers[layerName];
  if (!layer) return;

  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    const props = feature.properties as Record<string, unknown>;

    const name = typeof props.n === 'string' ? props.n.trim() : '';
    if (!name) continue; // 無名の地物は検索できないので載せない

    const id = typeof props.id === 'string' && props.id ? props.id : `${layerName}/${name}`;
    const coords = flattenCoords(feature.toGeoJSON(x, y, z).geometry);
    if (coords.length === 0) continue;

    let rec = acc.get(id);
    if (!rec) {
      rec = {
        n: name,
        t: layerName === 'generators' ? 'g' : props.t === 'plant' ? 'p' : 's',
        o: typeof props.o === 'string' && props.o ? props.o : undefined,
        minLon: Infinity,
        maxLon: -Infinity,
        minLat: Infinity,
        maxLat: -Infinity,
      };
      acc.set(id, rec);
    }
    // 同じ地物が隣接タイルに分割されて現れるため、全断片の範囲を統合する
    for (const [lon, lat] of coords) {
      if (lon < rec.minLon) rec.minLon = lon;
      if (lon > rec.maxLon) rec.maxLon = lon;
      if (lat < rec.minLat) rec.minLat = lat;
      if (lat > rec.maxLat) rec.maxLat = lat;
    }
  }
}

/** あらゆる GeoJSON ジオメトリから座標の平坦な配列を取り出す */
function flattenCoords(geometry: { type: string; coordinates: unknown }): [number, number][] {
  const out: [number, number][] = [];
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      out.push([node[0], node[1]]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry.coordinates);
  return out;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

// 同一施設が node と way の両方でマッピングされていることが多く、そのままだと
// 検索結果に「西新宿変電所」が2件並ぶ。同名・同種別で十分近いものは1件に統合する。
// 遠く離れた同名施設（各地の「第一変電所」等）は別物なので距離で判定する。
const MERGE_DISTANCE_DEG = 0.003; // 緯度0.003° ≒ 330m

function toEntries(acc: Map<string, Accum>): IndexEntry[] {
  const raw = [...acc.values()].map<IndexEntry>((r) => ({
    n: r.n,
    t: r.t,
    lon: round4((r.minLon + r.maxLon) / 2),
    lat: round4((r.minLat + r.maxLat) / 2),
    ...(r.o ? { o: r.o } : {}),
  }));

  const groups = new Map<string, IndexEntry[]>();
  for (const e of raw) {
    const key = `${e.t}|${e.n}`;
    const g = groups.get(key);
    if (g) g.push(e);
    else groups.set(key, [e]);
  }

  const merged: IndexEntry[] = [];
  for (const group of groups.values()) {
    const clusters: IndexEntry[] = [];
    for (const e of group) {
      const near = clusters.find(
        (c) => Math.abs(c.lat - e.lat) < MERGE_DISTANCE_DEG && Math.abs(c.lon - e.lon) < MERGE_DISTANCE_DEG,
      );
      // 事業者名は片方にしか付いていないことがあるので、統合時に補完する
      if (near) near.o ??= e.o;
      else clusters.push(e);
    }
    merged.push(...clusters);
  }

  return merged.sort((a, b) => a.n.localeCompare(b.n, 'ja'));
}

async function main() {
  const buf = await readFile(TILE_PATH);
  const pmtiles = new PMTiles(new FileSource(buf));
  const header = await pmtiles.getHeader();
  console.log(`入力: ${TILE_PATH} (z${header.minZoom}-${header.maxZoom}, ${(buf.length / 1024 / 1024).toFixed(1)}MB)`);

  // --verify: 隣接ズームでも件数が増えないこと（= そのズームで間引かれていないこと）を確認する
  if (process.argv.includes('--verify')) {
    for (const z of [ZOOM - 1, ZOOM, ZOOM + 1]) {
      const a = await buildIndex(pmtiles, z);
      console.log(`  z${z}: ${a.size} 件`);
    }
    return;
  }

  const acc = await buildIndex(pmtiles, ZOOM);
  const entries = toEntries(acc);
  const json = JSON.stringify(entries);
  await writeFile(OUT_PATH, json);

  const byType = entries.reduce<Record<string, number>>((m, e) => ({ ...m, [e.t]: (m[e.t] ?? 0) + 1 }), {});
  console.log(`z${ZOOM} で抽出: ${entries.length} 件`);
  console.log(`  変電所 ${byType.s ?? 0} / 発電所 ${byType.p ?? 0} / 発電設備 ${byType.g ?? 0}`);
  console.log(`出力: ${OUT_PATH} (${(Buffer.byteLength(json) / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
