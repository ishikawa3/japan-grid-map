// power.geojsonseq を lines / nodes / towers / generators の4ファイルに振り分け、属性を正規化する。
// ストリーム処理（1行ずつ）で行い、全件をメモリに載せない。
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { WriteStream } from 'node:fs';
import { classOf, CLASSES } from './lib/voltage';

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, string | undefined>;
}

const IN_FILE = 'data/interim/power.geojsonseq';
const OUT_LINES = 'data/interim/lines.geojsonseq';
const OUT_NODES = 'data/interim/nodes.geojsonseq';
const OUT_TOWERS = 'data/interim/towers.geojsonseq';
const OUT_GENERATORS = 'data/interim/generators.geojsonseq';

async function main() {
  await mkdir('data/interim', { recursive: true });

  const rl = createInterface({ input: createReadStream(IN_FILE, 'utf8'), crlfDelay: Infinity });
  const linesOut = createWriteStream(OUT_LINES);
  const nodesOut = createWriteStream(OUT_NODES);
  const towersOut = createWriteStream(OUT_TOWERS);
  const generatorsOut = createWriteStream(OUT_GENERATORS);

  const classCounts = new Map<number, number>(CLASSES.map((c) => [c.c, 0]));
  let nodeCount = 0;
  let towerCount = 0;
  let generatorCount = 0;
  let skipped = 0;

  for await (const line of rl) {
    // osmium export -f geojsonseq は RFC 8142 (GeoJSON Text Sequences) に従い、
    // 各レコードの先頭に RS (U+001E) を付与する。JS の trim() は RS を空白と
    // 見なさず除去しないため、先に明示的に取り除いてから trim/parse する。
    const trimmed = line.replace(/^\x1e/, '').trim();
    if (!trimmed) continue;

    let feature: GeoJsonFeature;
    try {
      feature = JSON.parse(trimmed);
    } catch {
      skipped++;
      continue;
    }

    const power = feature.properties?.power;
    const id = String(feature.id ?? feature.properties?.['@id'] ?? '');

    if (power === 'line' || power === 'minor_line' || power === 'cable') {
      writeLine(linesOut, feature, id);
      const { c } = classOf(feature.properties?.voltage);
      classCounts.set(c, (classCounts.get(c) ?? 0) + 1);
    } else if (power === 'substation' || power === 'plant') {
      writeNode(nodesOut, feature, id, power);
      nodeCount++;
    } else if (power === 'tower' || power === 'portal') {
      writeTower(towersOut, feature, id, power);
      towerCount++;
    } else if (power === 'generator') {
      writeGenerator(generatorsOut, feature, id);
      generatorCount++;
    } else {
      skipped++;
    }
  }

  await Promise.all([closeStream(linesOut), closeStream(nodesOut), closeStream(towersOut), closeStream(generatorsOut)]);

  console.log('--- normalize summary ---');
  console.log(`nodes: ${nodeCount}, towers: ${towerCount}, generators: ${generatorCount}, skipped: ${skipped}`);
  console.log('lines by voltage class:');
  for (const cls of CLASSES) {
    console.log(`  class ${cls.c} (${cls.label}): ${classCounts.get(cls.c) ?? 0}`);
  }
  const highVoltageCount = (classCounts.get(4) ?? 0) + (classCounts.get(3) ?? 0);
  if (highVoltageCount < 1000) {
    console.warn(
      `警告: 220kV以上(クラス3+4)の線が ${highVoltageCount} 本と少なすぎます。voltage タグの解釈にバグがある可能性があります`,
    );
  }
}

function writeLine(stream: WriteStream, feature: GeoJsonFeature, id: string) {
  const p = feature.properties;
  const { c, v } = classOf(p.voltage);
  const props: Record<string, unknown> = { c, v, id };
  if (p.name) props.n = p.name;
  if (p.operator) props.o = p.operator;
  if (p.circuits) props.ci = toNumberOrUndefined(p.circuits);
  if (p.cables) props.ca = toNumberOrUndefined(p.cables);
  stream.write(JSON.stringify({ ...feature, properties: props }) + '\n');
}

function writeNode(stream: WriteStream, feature: GeoJsonFeature, id: string, power: string) {
  const p = feature.properties;
  const props: Record<string, unknown> = { t: power, id };
  if (p.name) props.n = p.name;
  if (p.operator) props.o = p.operator;
  if (p['plant:source']) props.src = p['plant:source'];

  // nodes レイヤは代表点だけを持つ前提（フロントは circle レイヤで描画する）。
  // osmium export は power=substation の閉じた way をエリアとして扱わず LineString で
  // 出力することがあり、これを素通しすると circle レイヤが頂点ごとに円を描いてしまい、
  // 検索インデックスからも漏れる。Point 以外はすべて代表点に落とす。
  let geometry = feature.geometry;
  if (geometry && geometry.type !== 'Point') {
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const centroid = polygonCentroid(geometry);
      if (centroid) {
        props.area = Math.round(centroid.areaM2);
        geometry = { type: 'Point', coordinates: centroid.point };
      }
    } else {
      const center = boundsCenter(geometry);
      if (center) geometry = { type: 'Point', coordinates: center };
    }
  }

  stream.write(JSON.stringify({ ...feature, geometry, properties: props }) + '\n');
}

function writeTower(stream: WriteStream, feature: GeoJsonFeature, id: string, power: string) {
  const props: Record<string, unknown> = { t: power, id };
  stream.write(JSON.stringify({ ...feature, properties: props }) + '\n');
}

// power=generator: 個別の発電設備（太陽光パネル群・風車1基・小水力施設など）。
// power=plant（発電所全体）とは別に付与される、より粒度の細かいタグ。
function writeGenerator(stream: WriteStream, feature: GeoJsonFeature, id: string) {
  const p = feature.properties;
  const props: Record<string, unknown> = { t: 'generator', id };
  if (p.name) props.n = p.name;
  if (p.operator) props.o = p.operator;
  if (p['generator:source']) props.src = p['generator:source'];
  if (p['generator:method']) props.m = p['generator:method'];
  const output = parseGeneratorOutput(p['generator:output:electricity']);
  if (output) props.out = output;
  stream.write(JSON.stringify({ ...feature, properties: props }) + '\n');
}

// "1.5 MW" / "500 kW" のような自由記述を人間可読な文字列のまま通す
// （"yes" 等パース不能な値は捨てる。数値解析は行わず表示用途に留める）。
function parseGeneratorOutput(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!/^[\d.]+\s*[kMG]?W$/i.test(trimmed)) return undefined;
  return trimmed;
}

function toNumberOrUndefined(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** 任意ジオメトリの座標範囲の中心を代表点として返す（Polygon以外のフォールバック） */
function boundsCenter(geometry: { type: string; coordinates: unknown }): [number, number] | null {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lon, lat] = node as [number, number];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const child of node) walk(child);
  };
  walk(geometry.coordinates);

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  return [(minLon + maxLon) / 2, (minLat + maxLat) / 2];
}

/** 面積(m²)と重心を求める（等長方位図法近似、緯度で経度方向をスケール補正） */
function polygonCentroid(geometry: {
  type: string;
  coordinates: unknown;
}): { point: [number, number]; areaM2: number } | null {
  const ring: [number, number][] =
    geometry.type === 'Polygon'
      ? (geometry.coordinates as [number, number][][])[0]
      : (geometry.coordinates as [number, number][][][])[0]?.[0];

  if (!ring || ring.length < 3) return null;

  const lat0 = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const mPerDegLat = 111_320;
  const mPerDegLon = 111_320 * Math.cos((lat0 * Math.PI) / 180);

  const pts = ring.map(([lon, lat]) => [lon * mPerDegLon, lat * mPerDegLat]);

  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;

  if (Math.abs(area) < 1e-9) {
    const avgLon = ring.reduce((s, [lon]) => s + lon, 0) / ring.length;
    const avgLat = ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
    return { point: [avgLon, avgLat], areaM2: 0 };
  }

  cx /= 6 * area;
  cy /= 6 * area;

  const lon = cx / mPerDegLon;
  const lat = cy / mPerDegLat;
  return { point: [lon, lat], areaM2: Math.abs(area) };
}

function closeStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    stream.end();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
