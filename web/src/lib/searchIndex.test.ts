import { describe, expect, it } from 'vitest';
import { searchFacilities, type FacilityEntry } from './searchIndex';

const entries: FacilityEntry[] = [
  { n: '新宿変電所', t: 's', lon: 139.6889, lat: 35.6908 },
  { n: '西新宿変電所', t: 's', lon: 139.6986, lat: 35.6926 },
  { n: '新宿', t: 's', lon: 139.7, lat: 35.69 },
  { n: '川崎火力発電所', t: 'p', lon: 139.7, lat: 35.5 },
  { n: 'ＡＢＣ発電所', t: 'p', lon: 135.0, lat: 34.0 },
  { n: 'カブシキ変電所', t: 's', lon: 136.0, lat: 35.0 },
];

describe('searchFacilities', () => {
  it('完全一致 → 前方一致 → 部分一致 の順に並べる', () => {
    const result = searchFacilities(entries, '新宿');
    expect(result.map((e) => e.n)).toEqual(['新宿', '新宿変電所', '西新宿変電所']);
  });

  it('部分一致でも拾える', () => {
    expect(searchFacilities(entries, '火力').map((e) => e.n)).toEqual(['川崎火力発電所']);
  });

  it('全角英数を半角として扱う', () => {
    expect(searchFacilities(entries, 'abc').map((e) => e.n)).toEqual(['ＡＢＣ発電所']);
  });

  it('ひらがなでカタカナ名を検索できる', () => {
    expect(searchFacilities(entries, 'かぶしき').map((e) => e.n)).toEqual(['カブシキ変電所']);
  });

  it('空クエリでは何も返さない', () => {
    expect(searchFacilities(entries, '')).toEqual([]);
    expect(searchFacilities(entries, '   ')).toEqual([]);
  });

  it('該当なしでは空配列', () => {
    expect(searchFacilities(entries, '存在しない施設')).toEqual([]);
  });

  it('limit を超えて返さない', () => {
    expect(searchFacilities(entries, '所', 2)).toHaveLength(2);
  });

  // 以前は候補が limit*40 件に達すると走査を打ち切っており、名前順で後ろにある
  // 完全一致を取りこぼしていた（実データの "発電所" で完全一致が消えていた）。
  it('マッチが大量にあっても、名前順で後ろにある完全一致を取りこぼさない', () => {
    const many: FacilityEntry[] = [
      // 「〜発電所」を大量に並べ、完全一致の「発電所」を最後尾に置く
      ...Array.from({ length: 3000 }, (_, i) => ({
        n: `あ${String(i).padStart(4, '0')}発電所`,
        t: 'p' as const,
        lon: 139,
        lat: 35,
      })),
      { n: '発電所', t: 'p', lon: 139, lat: 35 },
    ];
    expect(searchFacilities(many, '発電所')[0].n).toBe('発電所');
  });
});
