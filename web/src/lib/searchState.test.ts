import { describe, expect, it } from 'vitest';
import { describeSearchState } from './searchState';

const base = { hasQuery: true, loaded: true, loading: false, error: null, count: 3 };

describe('describeSearchState', () => {
  it('入力が空なら何も出さない', () => {
    expect(describeSearchState({ ...base, hasQuery: false })).toEqual({
      showList: false,
      visibleStatus: null,
      announcement: '',
    });
  });

  it('読み込み中は画面に表示するが読み上げない（打鍵中に割り込まない）', () => {
    expect(describeSearchState({ ...base, loaded: false, loading: true })).toEqual({
      showList: false,
      visibleStatus: '読み込み中…',
      announcement: '',
    });
  });

  it('エラーは表示も読み上げもする', () => {
    const r = describeSearchState({ ...base, error: 'HTTP 404' });
    expect(r).toEqual({ showList: false, visibleStatus: 'HTTP 404', announcement: 'HTTP 404' });
  });

  it('インデックス未取得（読み込み開始前）は何も出さない', () => {
    expect(describeSearchState({ ...base, loaded: false, count: 0 }).visibleStatus).toBeNull();
  });

  it('0件なら「該当なし」を表示・読み上げ、リストは出さない', () => {
    expect(describeSearchState({ ...base, count: 0 })).toEqual({
      showList: false,
      visibleStatus: '該当する施設がありません',
      announcement: '該当する施設がありません',
    });
  });

  it('候補があればリストを出し、件数を読み上げる（状態表示は出さない）', () => {
    expect(describeSearchState(base)).toEqual({ showList: true, visibleStatus: null, announcement: '候補 3 件' });
  });
});
