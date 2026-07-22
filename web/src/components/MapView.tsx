import maplibregl, { type FilterSpecification, type Map as MLMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { useEffect, useRef } from 'react';
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
            attribution: '地理院タイル',
            maxzoom: 18,
          },
          grid: {
            type: 'vector',
            url: `pmtiles://${tilesUrl}`,
            attribution: '© OpenStreetMap contributors',
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
          {
            id: 'nodes-substations',
            type: 'circle',
            source: 'grid',
            'source-layer': 'nodes',
            filter: ['==', ['get', 't'], 'substation'],
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
            filter: ['==', ['get', 't'], 'plant'],
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
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const clickableLayers = ['lines', 'nodes-substations', 'nodes-plants', 'towers'];
    const layerToKind: Record<string, 'lines' | 'nodes' | 'towers'> = {
      lines: 'lines',
      'nodes-substations': 'nodes',
      'nodes-plants': 'nodes',
      towers: 'towers',
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, { layers: clickableLayers });
      const f = features[0];
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

    return () => {
      map.off('click', onClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // フィルタ状態を MapLibre の setFilter に反映する。React の再レンダリングは発生させない。
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      const { visibleClasses, showSubstations, showPlants, showTowers } = useMapStore.getState();

      const classFilter: FilterSpecification = [
        'in',
        ['to-number', ['get', 'c']],
        ['literal', Array.from(visibleClasses)],
      ];
      map.setFilter('lines', classFilter);
      map.setFilter('lines-glow', classFilter);
      map.setLayoutProperty('nodes-substations', 'visibility', showSubstations ? 'visible' : 'none');
      map.setLayoutProperty('nodes-plants', 'visibility', showPlants ? 'visible' : 'none');
      map.setLayoutProperty('towers', 'visibility', showTowers ? 'visible' : 'none');
    };

    const map = mapRef.current;
    if (map) {
      if (map.isStyleLoaded()) apply();
      else map.once('load', apply);
    }

    const unsubscribe = useMapStore.subscribe(apply);
    return unsubscribe;
  }, []);

  return <div ref={containerRef} className="map-container" />;
}
