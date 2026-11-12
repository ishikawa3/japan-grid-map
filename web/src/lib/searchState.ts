// 検索パネルの表示状態の判定。UI から切り離してテストできるようにしている。

/** 入力・読み込み状態から、候補リストの表示有無・画面上の状態表示・読み上げ文言を決める */
export function describeSearchState({
  hasQuery,
  loaded,
  loading,
  error,
  count,
}: {
  hasQuery: boolean;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  count: number;
}): { showList: boolean; visibleStatus: string | null; announcement: string } {
  if (!hasQuery) return { showList: false, visibleStatus: null, announcement: '' };
  if (loading) return { showList: false, visibleStatus: '読み込み中…', announcement: '' };
  if (error) return { showList: false, visibleStatus: error, announcement: error };
  if (!loaded) return { showList: false, visibleStatus: null, announcement: '' };
  if (count === 0) {
    const none = '該当する施設がありません';
    return { showList: false, visibleStatus: none, announcement: none };
  }
  return { showList: true, visibleStatus: null, announcement: `候補 ${count} 件` };
}
