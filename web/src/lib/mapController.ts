// MapView が保持する MapLibre インスタンスへの参照を、React のツリー外
// （検索UI・WebMCPツール）から安全に使うための薄い仲介レイヤ。
// MapView 以外が直接 Map を触らないよう、公開する操作をここに限定する。
import type { Map as MLMap } from 'maplibre-gl';

let map: MLMap | null = null;

/** MapView からのみ呼ぶ。アンマウント時は null を渡すこと。 */
export function setMap(instance: MLMap | null) {
  map = instance;
}

export function getMap(): MLMap | null {
  return map;
}

export interface FlyToOptions {
  lon: number;
  lat: number;
  zoom?: number;
}

/** 指定座標へ移動する。地図が未初期化なら false を返す。 */
export function flyTo({ lon, lat, zoom = 14 }: FlyToOptions): boolean {
  if (!map) return false;
  map.flyTo({ center: [lon, lat], zoom, essential: true });
  return true;
}

/** 現在の表示中心とズームを返す */
export function getView(): { lon: number; lat: number; zoom: number } | null {
  if (!map) return null;
  const c = map.getCenter();
  return { lon: round6(c.lng), lat: round6(c.lat), zoom: round2(map.getZoom()) };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const round2 = (n: number) => Math.round(n * 100) / 100;
