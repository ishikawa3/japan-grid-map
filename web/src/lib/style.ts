import type { ExpressionSpecification } from 'maplibre-gl';
import { CLASSES } from '../../../scripts/lib/voltage';

// tippecanoe は数値属性を文字列化することがあるため to-number で保険をかける。
const classExpr: ExpressionSpecification = ['to-number', ['get', 'c']];

export const lineColorExpr: ExpressionSpecification = [
  'match',
  classExpr,
  ...CLASSES.flatMap((c) => [c.c, c.color]),
  CLASSES[CLASSES.length - 1].color,
] as unknown as ExpressionSpecification;

function makeLineWidthExpr(scale: number): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    4,
    ['match', classExpr, ...CLASSES.flatMap((c) => [c.c, c.w * 0.5 * scale]), 0.4 * scale],
    14,
    ['match', classExpr, ...CLASSES.flatMap((c) => [c.c, c.w * 2.2 * scale]), 1.6 * scale],
  ] as unknown as ExpressionSpecification;
}

// zoom を含む interpolate 式は他の式（'*' 等）にネストできないため、
// 通常線とグロー線それぞれ独立した interpolate 式として定義する。
export const lineWidthExpr = makeLineWidthExpr(1);
export const lineGlowWidthExpr = makeLineWidthExpr(3);
