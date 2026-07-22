/** タイルURLの解決。VITE_PMTILES_URL 未設定時は同梱のサンプルタイルを使う。 */
export function resolvePmtilesUrl(): string {
  return import.meta.env.VITE_PMTILES_URL ?? `${import.meta.env.BASE_URL}tiles/grid.pmtiles`;
}
