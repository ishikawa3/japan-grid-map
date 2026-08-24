// 本番の OSM 抽出を待たずにフロントエンドの動作確認をするための、
// 関東近郊を模した架空のサンプル送電網データを生成する（実在の系統とは一致しない）。
import { mkdir, writeFile } from 'node:fs/promises';
import { classOf } from '../lib/voltage';

interface Substation {
  id: string;
  name: string;
  lon: number;
  lat: number;
}

const substations: Substation[] = [
  { id: 'sub-1', name: '新東京変電所（サンプル）', lon: 139.6917, lat: 35.6895 },
  { id: 'sub-2', name: '横浜変電所（サンプル）', lon: 139.6380, lat: 35.4437 },
  { id: 'sub-3', name: '川崎変電所（サンプル）', lon: 139.7029, lat: 35.5308 },
  { id: 'sub-4', name: 'さいたま変電所（サンプル）', lon: 139.6489, lat: 35.8617 },
  { id: 'sub-5', name: '千葉変電所（サンプル）', lon: 140.1233, lat: 35.6073 },
  { id: 'sub-6', name: '成田変電所（サンプル）', lon: 140.3197, lat: 35.7647 },
];

interface SampleLine {
  from: string;
  to: string;
  voltage: string;
  name: string;
  operator: string;
}

const lines: SampleLine[] = [
  { from: 'sub-1', to: 'sub-2', voltage: '500000', name: '東京湾岸幹線（サンプル）', operator: '東京電力パワーグリッド' },
  { from: 'sub-1', to: 'sub-3', voltage: '275000', name: '川崎連系線（サンプル）', operator: '東京電力パワーグリッド' },
  { from: 'sub-1', to: 'sub-4', voltage: '154000', name: 'さいたま線（サンプル）', operator: '東京電力パワーグリッド' },
  { from: 'sub-1', to: 'sub-5', voltage: '154000;66000', name: '千葉東線（サンプル）', operator: '東京電力パワーグリッド' },
  { from: 'sub-5', to: 'sub-6', voltage: '66000', name: '成田支線（サンプル）', operator: '東京電力パワーグリッド' },
  { from: 'sub-2', to: 'sub-3', voltage: '66 kV', name: '京浜線（サンプル）', operator: '東京電力パワーグリッド' },
  { from: 'sub-3', to: 'sub-4', voltage: '', name: '未電圧タグ線（サンプル）', operator: '東京電力パワーグリッド' },
];

function substationFeature(s: Substation) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    properties: { t: 'substation', n: s.name, o: '東京電力パワーグリッド', id: s.id },
  };
}

function lineFeature(l: SampleLine, index: number) {
  const from = substations.find((s) => s.id === l.from)!;
  const to = substations.find((s) => s.id === l.to)!;
  const { c, v } = classOf(l.voltage || undefined);
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [from.lon, from.lat],
        [to.lon, to.lat],
      ],
    },
    properties: { c, v, n: l.name, o: l.operator, id: `line-${index}` },
  };
}

function towerFeature(lon: number, lat: number, id: string) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { t: 'tower', id },
  };
}

interface SampleGenerator {
  id: string;
  name?: string;
  source: string;
  lon: number;
  lat: number;
}

const generators: SampleGenerator[] = [
  { id: 'gen-1', name: '検見川浜メガソーラー（サンプル）', source: 'solar', lon: 140.05, lat: 35.63 },
  { id: 'gen-2', name: '房総ウィンドファーム1号機（サンプル）', source: 'wind', lon: 140.25, lat: 35.72 },
  { id: 'gen-3', source: 'hydro', lon: 139.72, lat: 35.72 },
];

function generatorFeature(g: SampleGenerator) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
    properties: { t: 'generator', src: g.source, ...(g.name ? { n: g.name } : {}), id: g.id },
  };
}

async function main() {
  await mkdir('data/sample', { recursive: true });

  const nodeLines = substations.map((s) => JSON.stringify(substationFeature(s)));
  const lineLines = lines.map((l, i) => JSON.stringify(lineFeature(l, i)));

  // 500kV線の中間に鉄塔を数本サンプル配置（towers レイヤの動作確認用）
  const towerLines: string[] = [];
  const a = substations[0];
  const b = substations[1];
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    towerLines.push(
      JSON.stringify(towerFeature(a.lon + (b.lon - a.lon) * t, a.lat + (b.lat - a.lat) * t, `tower-${i}`)),
    );
  }

  const generatorLines = generators.map((g) => JSON.stringify(generatorFeature(g)));

  await writeFile('data/sample/nodes.geojsonseq', nodeLines.join('\n') + '\n');
  await writeFile('data/sample/lines.geojsonseq', lineLines.join('\n') + '\n');
  await writeFile('data/sample/towers.geojsonseq', towerLines.join('\n') + '\n');
  await writeFile('data/sample/generators.geojsonseq', generatorLines.join('\n') + '\n');

  console.log(
    `生成完了: nodes=${nodeLines.length}, lines=${lineLines.length}, towers=${towerLines.length}, generators=${generatorLines.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
