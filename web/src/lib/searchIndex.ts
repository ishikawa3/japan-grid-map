// 施設名の検索インデックス。約5,300件・471KB(gzip 92KB)あるため初回描画は妨げず、
// 検索が実際に使われる時点で初めて取得する。

export type FacilityKind = 's' | 'p' | 'g';

export interface FacilityEntry {
  /** 名称 */
  n: string;
  /** 種別 */
  t: FacilityKind;
  lon: number;
  lat: number;
  /** 事業者 */
  o?: string;
}

export const KIND_LABEL: Record<FacilityKind, string> = {
  s: '変電所',
  p: '発電所',
  g: '発電設備',
};

let cache: FacilityEntry[] | null = null;
let inflight: Promise<FacilityEntry[]> | null = null;

/** インデックスを取得する（多重呼び出しは1回の fetch に集約される） */
export function loadFacilities(): Promise<FacilityEntry[]> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch(`${import.meta.env.BASE_URL}search-index.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`検索インデックスを取得できませんでした (HTTP ${res.status})`);
      return res.json() as Promise<FacilityEntry[]>;
    })
    .then((data) => {
      cache = data;
      return data;
    })
    .catch((err) => {
      inflight = null; // 失敗したら次回再試行できるようにする
      throw err;
    });
  return inflight;
}

/**
 * 前方一致 > 部分一致 の順で並べ、短い名前を優先する。
 * 全国に同名施設が多い（「第一変電所」等）ため、完全一致を最優先にする。
 */
export function searchFacilities(entries: FacilityEntry[], rawQuery: string, limit = 20): FacilityEntry[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  const scored: { entry: FacilityEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = normalize(entry.n);
    const idx = name.indexOf(query);
    if (idx === -1) continue;

    let score: number;
    if (name === query) score = 0;
    else if (idx === 0) score = 1;
    else score = 2;

    scored.push({ entry, score: score * 1000 + name.length });
    // 全件走査は5,000件程度なら十分速いが、上限に達したら早めに打ち切る
    if (scored.length > limit * 40) break;
  }

  return scored
    .sort((a, b) => a.score - b.score || a.entry.n.localeCompare(b.entry.n, 'ja'))
    .slice(0, limit)
    .map((s) => s.entry);
}

/** 全角英数・カタカナ/ひらがな差・大文字小文字を吸収して比較しやすくする */
function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ん]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .trim();
}
