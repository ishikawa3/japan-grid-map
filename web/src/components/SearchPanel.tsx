import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { flyTo } from '../lib/mapController';
import {
  KIND_LABEL,
  loadFacilities,
  searchFacilities,
  type FacilityEntry,
} from '../lib/searchIndex';

const KIND_COLOR: Record<FacilityEntry['t'], string> = {
  s: '#e8eef5',
  p: '#ffd166',
  g: '#5ec8d8',
};

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FacilityEntry[]>([]);
  const [entries, setEntries] = useState<FacilityEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // キーボード操作で選択中の候補（-1 は未選択）
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // 矢印キーで選択が動いたときだけ候補をスクロールさせる（ホバーで動かすとリストが
  // ポインタの下で流れ、次の候補の mouseenter を誘発してしまう）
  const scrollOnNextActive = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const listId = useId();

  // 入力が始まった時点で初めてインデックスを取得する（初回描画を妨げない）
  const ensureLoaded = useCallback(() => {
    if (entries || loading) return;
    setLoading(true);
    setError(null);
    loadFacilities()
      .then(setEntries)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entries, loading]);

  useEffect(() => {
    if (!entries) {
      setResults([]);
      return;
    }
    setResults(searchFacilities(entries, query));
    setActiveIndex(-1);
  }, [entries, query]);

  const select = useCallback((entry: FacilityEntry) => {
    flyTo({ lon: entry.lon, lat: entry.lat, zoom: 14 });
    setQuery('');
    setResults([]);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      return;
    }
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      scrollOnNextActive.current = true;
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      scrollOnNextActive.current = true;
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  // 矢印キーで選んだ候補が見えるようにスクロールする（フォーカスは入力欄に残したまま）。
  // scrollIntoView は祖先やモバイルの visual viewport まで動かしうるので、listbox の
  // scrollTop だけを調整する。
  useEffect(() => {
    if (!scrollOnNextActive.current) return;
    scrollOnNextActive.current = false;
    const list = listRef.current;
    const item = list?.children[activeIndex] as HTMLElement | undefined;
    if (!list || !item) return;
    const top = item.offsetTop - list.clientTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [activeIndex]);

  const { showList, visibleStatus, announcement } = describeState({
    hasQuery: query.trim() !== '',
    loaded: entries !== null,
    loading,
    error,
    count: results.length,
  });

  // スクリーンリーダー向けの読み上げは打鍵ごとに変えず、入力が落ち着いてから一度だけ出す
  // （「該当なし」の繰り返し読み上げを避け、候補が出たときは件数も伝える）
  const [liveMessage, setLiveMessage] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setLiveMessage(announcement), 600);
    return () => clearTimeout(t);
  }, [announcement]);

  return (
    <div className="search-panel" role="search">
      {/* WAI-ARIA の combobox パターン: フォーカスは常に入力欄に置き、
          選択中の候補は aria-activedescendant で支援技術に伝える */}
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        className="search-input"
        placeholder="変電所・発電所を検索"
        aria-label="施設名で検索"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={query}
        onFocus={ensureLoaded}
        onChange={(e) => {
          ensureLoaded();
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
      />

      <ul
        ref={listRef}
        className="search-popup search-results"
        id={listId}
        role="listbox"
        aria-label="検索結果"
        hidden={!showList}
      >
        {showList &&
          results.map((entry, i) => (
            <li
              key={`${entry.n}-${entry.lon}-${entry.lat}`}
              id={`${listId}-${i}`}
              className={`search-result${i === activeIndex ? ' search-result-active' : ''}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseMove={(e) => {
                // mouseenter はキー操作でリストがスクロールしただけでも（ポインタの下に別の候補が
                // 来ると）発火し、矢印キーの選択を上書きしてしまう。実際にマウスが動いたときだけ追従する。
                const last = lastPointer.current;
                if (last && last.x === e.clientX && last.y === e.clientY) return;
                lastPointer.current = { x: e.clientX, y: e.clientY };
                if (i !== activeIndex) setActiveIndex(i);
              }}
              // 入力欄からフォーカスを奪わない
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(entry)}
            >
              <span className="search-result-dot" style={{ background: KIND_COLOR[entry.t] }} aria-hidden="true" />
              <span className="search-result-body">
                <span className="search-result-name">{entry.n}</span>
                <span className="search-result-meta">
                  {KIND_LABEL[entry.t]}
                  {entry.o ? ` · ${entry.o}` : ''}
                </span>
              </span>
            </li>
          ))}
      </ul>

      {/* listbox の子は option のみ許されるため、状態表示は listbox の外に出す */}
      {visibleStatus && <p className={`search-popup search-status${error ? ' search-error' : ''}`}>{visibleStatus}</p>}
      <div className="visually-hidden" role="status">
        {liveMessage}
      </div>
    </div>
  );
}

/** 入力・読み込み状態から、候補リストの表示有無・画面上の状態表示・読み上げ文言を決める */
function describeState({
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
