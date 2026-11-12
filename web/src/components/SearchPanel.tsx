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
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[activeIndex >= 0 ? activeIndex : 0]);
    }
  };

  // 矢印キーで選んだ候補が見えるようにスクロールする（フォーカスは入力欄に残したまま）
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listId]);

  const hasQuery = query.trim() !== '';
  const showList = hasQuery && !loading && !error && results.length > 0;
  // listbox の子は option のみ許されるため、状態表示は listbox の外に role=status で出す
  const status = !hasQuery
    ? null
    : loading
      ? '読み込み中…'
      : error
        ? error
        : entries && results.length === 0
          ? '該当する施設がありません'
          : null;

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

      <ul className="search-results" id={listId} role="listbox" aria-label="検索結果" hidden={!showList}>
        {showList &&
          results.map((entry, i) => (
            <li
              key={`${entry.n}-${entry.lon}-${entry.lat}`}
              id={`${listId}-${i}`}
              className={`search-result${i === activeIndex ? ' search-result-active' : ''}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
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

      <div className="search-live" role="status">
        {status && <p className={`search-results search-status${error ? ' search-error' : ''}`}>{status}</p>}
      </div>
    </div>
  );
}
