import { CLASSES } from '../../../scripts/lib/voltage';
import { useMapStore } from '../store/useMapStore';

export function LegendPanel() {
  const visibleClasses = useMapStore((s) => s.visibleClasses);
  const showSubstations = useMapStore((s) => s.showSubstations);
  const showPlants = useMapStore((s) => s.showPlants);
  const showTowers = useMapStore((s) => s.showTowers);
  const showGenerators = useMapStore((s) => s.showGenerators);
  const toggleClass = useMapStore((s) => s.toggleClass);
  const setShowSubstations = useMapStore((s) => s.setShowSubstations);
  const setShowPlants = useMapStore((s) => s.setShowPlants);
  const setShowTowers = useMapStore((s) => s.setShowTowers);
  const setShowGenerators = useMapStore((s) => s.setShowGenerators);

  return (
    <aside className="legend-panel" aria-label="凡例">
      <h1 className="legend-title">全国送電網マップ</h1>

      <section>
        <h2 className="legend-heading">電圧クラス</h2>
        <ul className="legend-list">
          {CLASSES.map((cls) => (
            <li key={cls.c}>
              <button
                type="button"
                className="legend-item"
                aria-pressed={visibleClasses.has(cls.c)}
                onClick={() => toggleClass(cls.c)}
              >
                <span
                  className="legend-swatch"
                  style={{ background: cls.color, opacity: visibleClasses.has(cls.c) ? 1 : 0.25 }}
                />
                <span className={visibleClasses.has(cls.c) ? '' : 'legend-label-dim'}>{cls.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="legend-heading">施設</h2>
        <ul className="legend-list">
          <li>
            <button type="button" className="legend-item" aria-pressed={showSubstations} onClick={() => setShowSubstations(!showSubstations)}>
              <span className="legend-swatch" style={{ background: '#e8eef5', opacity: showSubstations ? 1 : 0.25 }} />
              <span className={showSubstations ? '' : 'legend-label-dim'}>変電所</span>
            </button>
          </li>
          <li>
            <button type="button" className="legend-item" aria-pressed={showPlants} onClick={() => setShowPlants(!showPlants)}>
              <span className="legend-swatch" style={{ background: '#ffd166', opacity: showPlants ? 1 : 0.25 }} />
              <span className={showPlants ? '' : 'legend-label-dim'}>発電所</span>
            </button>
          </li>
          <li>
            <button type="button" className="legend-item" aria-pressed={showTowers} onClick={() => setShowTowers(!showTowers)}>
              <span className="legend-swatch" style={{ background: '#8899aa', opacity: showTowers ? 1 : 0.25 }} />
              <span className={showTowers ? '' : 'legend-label-dim'}>鉄塔（ズーム13以上）</span>
            </button>
          </li>
          <li>
            <button type="button" className="legend-item" aria-pressed={showGenerators} onClick={() => setShowGenerators(!showGenerators)}>
              <span className="legend-swatch" style={{ background: '#5ec8d8', opacity: showGenerators ? 1 : 0.25 }} />
              <span className={showGenerators ? '' : 'legend-label-dim'}>発電設備（個別、ズーム7以上）</span>
            </button>
          </li>
        </ul>
      </section>
    </aside>
  );
}
