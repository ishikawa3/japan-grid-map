/**
 * タイルURLの解決。VITE_PMTILES_URL 未設定時は同梱のタイルを使う。
 * GitHub Actions の `vars.X` は未定義でも空文字列に展開されるため、`??` ではなく
 * 空文字列も「未設定」として扱う判定にする（`??` だけだと "" がそのまま採用され、
 * 空URLで pmtiles プロトコルが壊れる）。
 */
export function resolvePmtilesUrl(): string {
  const configured = import.meta.env.VITE_PMTILES_URL;
  return configured ? configured : `${import.meta.env.BASE_URL}tiles/grid.pmtiles`;
}
