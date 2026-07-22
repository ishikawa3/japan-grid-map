import { describe, expect, it } from 'vitest';
import { classify, classOf, parseVoltage } from './voltage';

describe('parseVoltage', () => {
  it('takes the max of semicolon/comma separated values', () => {
    expect(parseVoltage('275000;66000')).toBe(275_000);
    expect(parseVoltage('66000,110000')).toBe(110_000);
  });

  it('normalizes unit-suffixed kV notation', () => {
    expect(parseVoltage('66 kV')).toBe(66_000);
    expect(parseVoltage('66kv')).toBe(66_000);
  });

  it('returns 0 for empty/missing/unparseable input', () => {
    expect(parseVoltage('')).toBe(0);
    expect(parseVoltage(undefined)).toBe(0);
    expect(parseVoltage(null)).toBe(0);
    expect(parseVoltage('unknown')).toBe(0);
  });

  it('treats negative or implausibly large values as invalid (class 0)', () => {
    expect(parseVoltage('-100000')).toBe(0);
    expect(parseVoltage('2000000')).toBe(0);
  });
});

describe('classify', () => {
  it('maps voltage to the correct class boundary', () => {
    expect(classify(500_000)).toBe(4);
    expect(classify(499_999)).toBe(3);
    expect(classify(275_000)).toBe(3);
    expect(classify(220_000)).toBe(3);
    expect(classify(219_999)).toBe(2);
    expect(classify(110_000)).toBe(2);
    expect(classify(77_000)).toBe(1);
    expect(classify(60_000)).toBe(1);
    expect(classify(59_999)).toBe(0);
    expect(classify(0)).toBe(0);
  });
});

describe('classOf', () => {
  it('combines parsing and classification', () => {
    expect(classOf('500000')).toEqual({ c: 4, v: 500_000 });
    expect(classOf('275000;66000')).toEqual({ c: 3, v: 275_000 });
    expect(classOf(undefined)).toEqual({ c: 0, v: 0 });
  });
});
