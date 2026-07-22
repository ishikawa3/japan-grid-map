// 電圧クラス定義とパーサ。scripts (normalize) と web (フロント) の両方から import される単一ソース。

export interface VoltageClass {
  c: number;
  label: string;
  min: number;
  color: string;
  w: number;
}

export const CLASSES: VoltageClass[] = [
  { c: 4, label: '500 kV 以上', min: 500_000, color: '#f4f1e6', w: 3.2 },
  { c: 3, label: '220–275 kV', min: 220_000, color: '#ff8a3d', w: 2.4 },
  { c: 2, label: '110–187 kV', min: 110_000, color: '#ffd166', w: 1.7 },
  { c: 1, label: '60–77 kV', min: 60_000, color: '#4dd6c1', w: 1.2 },
  { c: 0, label: '60 kV 未満・不明', min: 0, color: '#3f6f96', w: 0.8 },
];

const MAX_PLAUSIBLE_VOLTAGE = 1_000_000;

/**
 * OSM の `voltage` タグ値を最大電圧(V, 数値)に正規化する。
 * - "275000;66000" のようなセミコロン/カンマ区切りは最大値を採用
 * - "66 kV" / "66kv" のような単位付き表記は 66000 に変換
 * - 空・欠損・パース不能・負値・1,000,000超 は 0 (= クラス0) を返す
 */
export function parseVoltage(raw: string | undefined | null): number {
  if (!raw) return 0;

  const parts = raw.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return 0;

  let max = 0;
  for (const part of parts) {
    const v = parseVoltagePart(part);
    if (v !== null && v > max) max = v;
  }

  if (max < 0 || max > MAX_PLAUSIBLE_VOLTAGE) {
    console.warn(`[voltage] implausible value ignored: "${raw}"`);
    return 0;
  }

  return max;
}

function parseVoltagePart(part: string): number | null {
  const kvMatch = part.match(/^([\d.]+)\s*kv$/i);
  if (kvMatch) {
    const kv = Number.parseFloat(kvMatch[1]);
    return Number.isFinite(kv) ? kv * 1000 : null;
  }

  const numMatch = part.match(/^([\d.]+)$/);
  if (numMatch) {
    const v = Number.parseFloat(numMatch[1]);
    return Number.isFinite(v) ? v : null;
  }

  return null;
}

/** 最大電圧(V)から電圧クラス(0-4)を求める。CLASSES は min の降順であること前提。 */
export function classify(voltage: number): number {
  for (const cls of CLASSES) {
    if (voltage >= cls.min) return cls.c;
  }
  return 0;
}

export function classOf(raw: string | undefined | null): { c: number; v: number } {
  const v = parseVoltage(raw);
  return { c: classify(v), v };
}
