// OSM の generator:source タグ値 → 表示用の日本語ラベル。
// 値はセミコロン区切りの複数指定もあり得るため未知の値はそのまま表示する。
const LABELS: Record<string, string> = {
  solar: '太陽光',
  wind: '風力',
  hydro: '水力',
  nuclear: '原子力',
  gas: 'ガス',
  oil: '石油',
  coal: '石炭',
  diesel: 'ディーゼル',
  geothermal: '地熱',
  biomass: 'バイオマス',
  waste: '廃棄物',
  battery: '蓄電池',
};

export function generatorSourceLabel(raw: string | undefined): string {
  if (!raw) return '不明';
  return raw
    .split(';')
    .map((s) => LABELS[s.trim()] ?? s.trim())
    .join('・');
}
