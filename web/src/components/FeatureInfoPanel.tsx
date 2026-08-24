import { CLASSES } from '../../../scripts/lib/voltage';
import { generatorSourceLabel } from '../lib/generatorSource';
import { useMapStore } from '../store/useMapStore';

const CLASS_LABEL = new Map(CLASSES.map((c) => [c.c, c.label]));

export function FeatureInfoPanel() {
  const selected = useMapStore((s) => s.selected);
  const select = useMapStore((s) => s.select);

  if (!selected) return null;

  const { properties } = selected;
  const name = typeof properties.n === 'string' ? properties.n : '(名称不明)';
  // tippecanoe は数値属性を文字列化することがあるため Number() で保険をかける。
  const voltage = Number(properties.v);

  return (
    <div className="feature-info-panel" role="dialog" aria-label="施設情報">
      <button type="button" className="feature-info-close" onClick={() => select(null)} aria-label="閉じる">
        ×
      </button>
      <h2 className="feature-info-title">{name}</h2>
      <dl className="feature-info-list">
        {selected.layer === 'lines' && (
          <>
            <dt>電圧クラス</dt>
            <dd>{CLASS_LABEL.get(Number(properties.c)) ?? '不明'}</dd>
            {Number.isFinite(voltage) && voltage > 0 && (
              <>
                <dt>電圧</dt>
                <dd>{(voltage / 1000).toLocaleString()} kV</dd>
              </>
            )}
          </>
        )}
        {selected.layer === 'nodes' && (
          <>
            <dt>種別</dt>
            <dd>{properties.t === 'plant' ? '発電所' : '変電所'}</dd>
          </>
        )}
        {selected.layer === 'towers' && (
          <>
            <dt>種別</dt>
            <dd>鉄塔</dd>
          </>
        )}
        {selected.layer === 'generators' && (
          <>
            <dt>種別</dt>
            <dd>発電設備（{generatorSourceLabel(typeof properties.src === 'string' ? properties.src : undefined)}）</dd>
            {typeof properties.out === 'string' && (
              <>
                <dt>出力</dt>
                <dd>{properties.out}</dd>
              </>
            )}
          </>
        )}
        {typeof properties.o === 'string' && (
          <>
            <dt>事業者</dt>
            <dd>{properties.o}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
