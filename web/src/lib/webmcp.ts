// WebMCP (Web Model Context Protocol) 対応。
// ページの操作をAIエージェント向けの「ツール」として公開し、地図の移動・絞り込み・
// 施設検索をエージェントから実行できるようにする。
//
// 仕様の状態（2026-08時点）:
//   - W3C Web Machine Learning CG の Draft Community Group Report。標準化トラックには未到達
//   - Chrome は Origin Trial、Edge はフラグ付き実験実装。Firefox/Safari は未実装
//   - API の置き場所が navigator.modelContext → document.modelContext へ移動中
//     （Chrome 150 で navigator 側が非推奨）。両対応にしておく
// 未対応ブラウザでは何もしない（機能検出のみで例外を投げない）。

import { CLASSES } from '../../../scripts/lib/voltage';
import { flyTo, getView } from './mapController';
import { KIND_LABEL, loadFacilities, searchFacilities } from './searchIndex';
import { useMapStore } from '../store/useMapStore';

interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: ToolDescriptor): void;
  unregisterTool?(name: string): void;
}

/** 移行期のため document / navigator の両方を見る */
function getModelContext(): ModelContext | null {
  const fromDocument = (document as unknown as { modelContext?: ModelContext }).modelContext;
  if (fromDocument) return fromDocument;
  const fromNavigator = (navigator as unknown as { modelContext?: ModelContext }).modelContext;
  return fromNavigator ?? null;
}

const VOLTAGE_CLASS_DOC = CLASSES.map((c) => `${c.c}=${c.label}`).join(', ');

/**
 * ツールを登録する。戻り値はクリーンアップ関数（React の useEffect から返す用）。
 * 非対応ブラウザでは何も登録せず、no-op を返す。
 */
export function registerWebMcpTools(): () => void {
  const ctx = getModelContext();
  if (!ctx) return () => {};

  const tools: ToolDescriptor[] = [
    {
      name: 'search_power_facility',
      description:
        '日本全国の変電所・発電所・発電設備を名称で検索し、該当施設の名前・種別・事業者・座標を返す。地図は動かさない。',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '施設名の一部（例: "新宿", "柏崎刈羽"）' },
          limit: { type: 'number', description: '返す件数の上限（既定10、最大50）' },
        },
        required: ['query'],
      },
      execute: async (input) => {
        const query = String(input.query ?? '');
        const limit = clamp(Number(input.limit ?? 10) || 10, 1, 50);
        const entries = await loadFacilities();
        const found = searchFacilities(entries, query, limit);
        return {
          count: found.length,
          results: found.map((e) => ({
            name: e.n,
            kind: KIND_LABEL[e.t],
            operator: e.o ?? null,
            lon: e.lon,
            lat: e.lat,
          })),
        };
      },
    },
    {
      name: 'show_power_facility',
      description:
        '名称で検索した施設のうち最も一致するものへ地図を移動して表示する。検索結果が0件なら移動しない。',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '施設名の一部（例: "新宿変電所"）' },
          zoom: { type: 'number', description: '移動後のズーム（4〜16、既定14）' },
        },
        required: ['query'],
      },
      execute: async (input) => {
        const query = String(input.query ?? '');
        const zoom = clamp(Number(input.zoom ?? 14) || 14, 4, 16);
        const entries = await loadFacilities();
        const [best] = searchFacilities(entries, query, 1);
        if (!best) return { moved: false, reason: `"${query}" に一致する施設が見つかりませんでした` };
        const moved = flyTo({ lon: best.lon, lat: best.lat, zoom });
        return {
          moved,
          facility: { name: best.n, kind: KIND_LABEL[best.t], operator: best.o ?? null, lon: best.lon, lat: best.lat },
        };
      },
    },
    {
      name: 'move_map',
      description: '指定した緯度経度へ地図を移動する。',
      inputSchema: {
        type: 'object',
        properties: {
          lat: { type: 'number', description: '緯度（例: 35.68）' },
          lon: { type: 'number', description: '経度（例: 139.76）' },
          zoom: { type: 'number', description: 'ズーム（4〜16、既定12）' },
        },
        required: ['lat', 'lon'],
      },
      execute: async (input) => {
        const lat = Number(input.lat);
        const lon = Number(input.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return { moved: false, reason: '緯度経度が数値ではありません' };
        }
        const zoom = clamp(Number(input.zoom ?? 12) || 12, 4, 16);
        return { moved: flyTo({ lon, lat, zoom }), view: getView() };
      },
    },
    {
      name: 'get_map_view',
      description: '現在の地図の中心座標・ズーム、および表示中のレイヤ/電圧クラスの状態を返す。',
      annotations: { readOnlyHint: true },
      execute: async () => {
        const s = useMapStore.getState();
        return {
          view: getView(),
          visibleVoltageClasses: [...s.visibleClasses].sort(),
          layers: {
            substations: s.showSubstations,
            plants: s.showPlants,
            towers: s.showTowers,
            generators: s.showGenerators,
          },
          voltageClassLegend: VOLTAGE_CLASS_DOC,
        };
      },
    },
    {
      name: 'set_voltage_filter',
      description: `表示する送電線の電圧クラスを設定する。クラス: ${VOLTAGE_CLASS_DOC}`,
      inputSchema: {
        type: 'object',
        properties: {
          classes: {
            type: 'array',
            items: { type: 'number' },
            description: '表示したい電圧クラスの配列（例: [4,3] で220kV以上のみ）',
          },
        },
        required: ['classes'],
      },
      execute: async (input) => {
        const requested = Array.isArray(input.classes) ? input.classes.map(Number) : [];
        const valid = new Set(CLASSES.map((c) => c.c));
        const next = requested.filter((c) => valid.has(c));
        if (next.length === 0) {
          return { applied: false, reason: '有効な電圧クラスが指定されていません（0〜4を指定してください）' };
        }
        const store = useMapStore.getState();
        // ストアは個別トグルのAPIしか持たないため、差分だけトグルして目的の集合にする
        for (const c of valid) {
          const shouldShow = next.includes(c);
          if (useMapStore.getState().visibleClasses.has(c) !== shouldShow) store.toggleClass(c);
        }
        return { applied: true, visibleVoltageClasses: [...useMapStore.getState().visibleClasses].sort() };
      },
    },
    {
      name: 'set_layer_visibility',
      description: '変電所・発電所・鉄塔・発電設備の各レイヤの表示/非表示を切り替える。省略した項目は変更しない。',
      inputSchema: {
        type: 'object',
        properties: {
          substations: { type: 'boolean', description: '変電所' },
          plants: { type: 'boolean', description: '発電所' },
          towers: { type: 'boolean', description: '鉄塔（ズーム13以上で描画）' },
          generators: { type: 'boolean', description: '個別の発電設備（ズーム7以上で描画）' },
        },
      },
      execute: async (input) => {
        const s = useMapStore.getState();
        if (typeof input.substations === 'boolean') s.setShowSubstations(input.substations);
        if (typeof input.plants === 'boolean') s.setShowPlants(input.plants);
        if (typeof input.towers === 'boolean') s.setShowTowers(input.towers);
        if (typeof input.generators === 'boolean') s.setShowGenerators(input.generators);
        const now = useMapStore.getState();
        return {
          applied: true,
          layers: {
            substations: now.showSubstations,
            plants: now.showPlants,
            towers: now.showTowers,
            generators: now.showGenerators,
          },
        };
      },
    },
  ];

  const registered: string[] = [];
  for (const tool of tools) {
    try {
      ctx.registerTool(tool);
      registered.push(tool.name);
    } catch (err) {
      // 同名ツールの重複登録などは致命的ではないので、ページ自体は動かし続ける
      console.warn(`[webmcp] ツール "${tool.name}" の登録に失敗しました`, err);
    }
  }

  return () => {
    for (const name of registered) {
      try {
        ctx.unregisterTool?.(name);
      } catch {
        /* 解除できなくても致命的ではない */
      }
    }
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
