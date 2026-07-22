import { create } from 'zustand';
import { CLASSES } from '../../../scripts/lib/voltage';

export interface SelectedFeature {
  layer: 'lines' | 'nodes' | 'towers';
  properties: Record<string, unknown>;
}

interface MapState {
  visibleClasses: Set<number>;
  showSubstations: boolean;
  showPlants: boolean;
  showTowers: boolean;
  selected: SelectedFeature | null;
  toggleClass: (c: number) => void;
  setShowSubstations: (v: boolean) => void;
  setShowPlants: (v: boolean) => void;
  setShowTowers: (v: boolean) => void;
  select: (f: SelectedFeature | null) => void;
}

const ALL_CLASSES = new Set(CLASSES.map((c) => c.c));

function readInitialState() {
  const params = new URLSearchParams(window.location.search);
  const vParam = params.get('v');
  const visibleClasses = vParam
    ? new Set(
        vParam
          .split(',')
          .map((s) => Number.parseInt(s, 10))
          .filter((n) => ALL_CLASSES.has(n)),
      )
    : new Set(ALL_CLASSES);

  return {
    visibleClasses: visibleClasses.size > 0 ? visibleClasses : new Set(ALL_CLASSES),
    showSubstations: params.get('sub') !== '0',
    showPlants: params.get('plant') !== '0',
    showTowers: params.get('tower') === '1',
  };
}

function syncUrl(state: Pick<MapState, 'visibleClasses' | 'showSubstations' | 'showPlants' | 'showTowers'>) {
  const params = new URLSearchParams(window.location.search);
  params.set('v', Array.from(state.visibleClasses).sort().join(','));
  params.set('sub', state.showSubstations ? '1' : '0');
  params.set('plant', state.showPlants ? '1' : '0');
  params.set('tower', state.showTowers ? '1' : '0');
  const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}

const initial = readInitialState();

export const useMapStore = create<MapState>((set, get) => ({
  ...initial,
  selected: null,
  toggleClass: (c) => {
    const next = new Set(get().visibleClasses);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    set({ visibleClasses: next });
    syncUrl({ ...get(), visibleClasses: next });
  },
  setShowSubstations: (v) => {
    set({ showSubstations: v });
    syncUrl({ ...get(), showSubstations: v });
  },
  setShowPlants: (v) => {
    set({ showPlants: v });
    syncUrl({ ...get(), showPlants: v });
  },
  setShowTowers: (v) => {
    set({ showTowers: v });
    syncUrl({ ...get(), showTowers: v });
  },
  select: (f) => set({ selected: f }),
}));
