import maplibregl, { type FilterSpecification, type Map as MLMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { useEffect, useRef } from 'react';
import { setMap } from '../lib/mapController';
import { resolvePmtilesUrl } from '../lib/pmtilesUrl';
import { lineColorExpr, lineGlowWidthExpr, lineWidthExpr } from '../lib/style';
import { useMapStore } from '../store/useMapStore';
import 'maplibre-gl/dist/maplibre-gl.css';

let protocolRegistered = false;
function ensureProtocol() {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
}

// ページ読み込み時点の値を一度だけ記録する。maplibre は unmount 時（React StrictMode の
// mount→cleanup→再mount を含む）に hash:true だと URL のハッシュをクリアしてしまうため、
// effect 内で毎回 window.location.hash を見ると2回目のmountで初回ハッシュを見失う。
const initialHasLocationHash = /^#\d/.test(window.location.hash);

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    ensureProtocol();
    if (!containerRef.current) return;

    const tilesUrl = resolvePmtilesUrl();

    const map = new maplibregl.Map({
      container: containerRef.current,
      hash: true,
      ...(initialHasLocationHash ? {} : { center: [138.5, 37.0], zoom: 5 }),
      minZoom: 4,
      maxZoom: 16,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'gsi-pale': {
            type: 'raster',
            tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution:
              '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer noopener">地理院タイル</a>',
            maxzoom: 18,
          },
          grid: {
            type: 'vector',
            url: `pmtiles://${tilesUrl}`,
            // ODbL は「データがODbLの下にある」ことの明示を求めるため、ライセンスへのリンクも併記する
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer noopener">OpenStreetMap</a> contributors, <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noreferrer noopener">ODbL</a>',
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
          {
            id: 'gsi-pale-layer',
            type: 'raster',
            source: 'gsi-pale',
            paint: {
              'raster-brightness-min': 0,
              'raster-brightness-max': 0.32,
              'raster-saturation': -1,
              'raster-contrast': 0.1,
            },
          },
          {
            id: 'lines-glow',
            type: 'line',
            source: 'grid',
            'source-layer': 'lines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': lineColorExpr,
              'line-width': lineGlowWidthExpr,
              'line-blur': 6,
              'line-opacity': 0.35,
            },
          },
          {
            id: 'lines',
            type: 'line',
            source: 'grid',
            'source-layer': 'lines',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': lineColorExpr, 'line-width': lineWidthExpr },
          },
          // nodes レイヤには Point 以外（施設の外形線）も含まれる。circle レイヤは
          // 頂点ごとに円を描いてしまい塊のように見えるので、Point だけを円で描き、
          // 外形線は line レイヤで敷地の形として描く。
          // （03-normalize.ts の修正後に再生成したタイルでは全て Point になり、
          //   outline レイヤは自然に空になる）
          {
            id: 'nodes-substations-outline',
            type: 'line',
            source: 'grid',
            'source-layer': 'nodes',
            filter: ['all', ['==', ['get', 't'], 'substation'], ['!=', ['geometry-type'], 'Point']],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#e8eef5', 'line-width': 1.6, 'line-opacity': 0.85 },
          },
          {
            id: 'nodes-plants-outline',
            type: 'line',
            source: 'grid',
            'source-layer': 'nodes',
            filter: ['all', ['==', ['get', 't'], 'plant'], ['!=', ['geometry-type'], 'Point']],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffd166', 'line-width': 1.6, 'line-opacity': 0.85 },
          },
          {
            id: 'nodes-substations',
            type: 'circle',
            source: 'grid',
            'source-layer': 'nodes',
            filter: ['all', ['==', ['get', 't'], 'substation'], ['==', ['geometry-type'], 'Point']],
            paint: {
              'circle-color': '#e8eef5',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 14, 6],
              'circle-stroke-color': '#3f6f96',
              'circle-stroke-width': 1.5,
            },
          },
          {
            id: 'nodes-plants',
            type: 'circle',
            source: 'grid',
            'source-layer': 'nodes',
            filter: ['all', ['==', ['get', 't'], 'plant'], ['==', ['geometry-type'], 'Point']],
            paint: {
              'circle-color': '#ffd166',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 14, 7],
              'circle-stroke-color': '#7a5b00',
              'circle-stroke-width': 1.5,
            },
          },
          {
            id: 'towers',
            type: 'circle',
            source: 'grid',
            'source-layer': 'towers',
            paint: {
              'circle-color': '#8899aa',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 16, 3],
            },
          },
          {
            id: 'nodes-generators',
            type: 'circle',
            source: 'grid',
            'source-layer': 'generators',
            paint: {
              'circle-color': '#5ec8d8',
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 14, 5],
              'circle-stroke-color': '#1d5b66',
              'circle-stroke-width': 1,
            },
          },
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const layerToKind: Record<string, 'lines' | 'nodes' | 'towers' | 'generators'> = {
      lines: 'lines',
      'nodes-substations': 'nodes',
      'nodes-substations-outline': 'nodes',
      'nodes-plants': 'nodes',
      'nodes-plants-outline': 'nodes',
      towers: 'towers',
      'nodes-generators': 'generators',
    };
    // 施設の点・外形線のどちらをクリックしても情報を出す
    const clickableLayers = Object.keys(layerToKind);

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayers });
      // queryRenderedFeatures は描画順で返すため、送電線より施設を優先して拾う
      const f = features.find((feat) => feat.layer.id !== 'lines') ?? features[0];
      if (!f) {
        useMapStore.getState().select(null);
        return;
      }
      useMapStore.getState().select({
        layer: layerToKind[f.layer.id],
        properties: f.properties ?? {},
      });
    };
    map.on('click', onClick);

    for (const id of clickableLayers) {
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }

    mapRef.current = map;
    setMap(map);

    return () => {
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // フィルタ状態を MapLibre の setFilter に反映する。React の再レンダリングは発生させない。
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      const { visibleClasses, showSubstations, showPlants, showTowers, showGenerators } = useMapStore.getState();

      const classFilter: FilterSpecification = [
        'in',
        ['to-number', ['get', 'c']],
        ['literal', Array.from(visibleClasses)],
      ];
      map.setFilter('lines', classFilter);
      map.setFilter('lines-glow', classFilter);
      // 施設は点と外形線の2レイヤに分かれているので両方まとめて切り替える
      const subVis = showSubstations ? 'visible' : 'none';
      const plantVis = showPlants ? 'visible' : 'none';
      map.setLayoutProperty('nodes-substations', 'visibility', subVis);
      map.setLayoutProperty('nodes-substations-outline', 'visibility', subVis);
      map.setLayoutProperty('nodes-plants', 'visibility', plantVis);
      map.setLayoutProperty('nodes-plants-outline', 'visibility', plantVis);
      map.setLayoutProperty('towers', 'visibility', showTowers ? 'visible' : 'none');
      map.setLayoutProperty('nodes-generators', 'visibility', showGenerators ? 'visible' : 'none');
    };

    const map = mapRef.current;
    if (map) {
      if (map.isStyleLoaded()) apply();
      else map.once('load', apply);
    }

    // フィルタに関係する項目が変わったときだけ apply する（selected の変化では再適用しない）。
    const unsubscribe = useMapStore.subscribe(
      (s) => [s.visibleClasses, s.showSubstations, s.showPlants, s.showTowers, s.showGenerators] as const,
      apply,
    );
    return unsubscribe;
  }, []);

  return <div ref={containerRef} className="map-container" />;
}
