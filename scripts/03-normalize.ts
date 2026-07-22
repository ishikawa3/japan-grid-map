// power.geojsonseq を lines / nodes / towers の3ファイルに振り分け、属性を正規化する。
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

async function main() {
  await mkdir('data/interim', { recursive: true });

  const rl = createInterface({ input: createReadStream(IN_FILE, 'utf8'), crlfDelay: Infinity });
  const linesOut = createWriteStream(OUT_LINES);
  const nodesOut = createWriteStream(OUT_NODES);
  const towersOut = createWriteStream(OUT_TOWERS);

  const classCounts = new Map<number, number>(CLASSES.map((c) => [c.c, 0]));
  let nodeCount = 0;
  let towerCount = 0;
  let skipped = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
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
    } else {
      skipped++;
    }
  }

  await Promise.all([closeStream(linesOut), closeStream(nodesOut), closeStream(towersOut)]);

  console.log('--- normalize summary ---');
  console.log(`nodes: ${nodeCount}, towers: ${towerCount}, skipped: ${skipped}`);
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

  let geometry = feature.geometry;
  if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
    const centroid = polygonCentroid(geometry);
    if (centroid) {
      props.area = Math.round(centroid.areaM2);
      geometry = { type: 'Point', coordinates: centroid.point };
    }
  }

  stream.write(JSON.stringify({ ...feature, geometry, properties: props }) + '\n');
}

function writeTower(stream: WriteStream, feature: GeoJsonFeature, id: string, power: string) {
  const props: Record<string, unknown> = { t: power, id };
  stream.write(JSON.stringify({ ...feature, properties: props }) + '\n');
}

function toNumberOrUndefined(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
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
