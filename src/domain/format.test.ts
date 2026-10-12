import { describe, it, expect } from 'vitest';
import { formatConcentration, formatDosePerKg, formatNumber, formatRange, formatUnitBadge, isRange, plainDuration } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [5, '5'],
    [2.5, '2.5'],
    [24, '24'],
    [24.31, '24.3'],
    [2.414, '2.41'],
    [0.2, '0.2'],
    [0.241, '0.241'],
    [0.0024, '0.0024'],
    [0.0000031, '0.0000031'],
    [0.00000031, '0.00000031'],
    [240.4, '240'],
    [10000, '10,000'],
    [1234.4, '1,234'],
    [999.6, '1,000'],
    [-10000, '-10,000'],
  ])('%s → %s', (n, out) => {
    expect(formatNumber(n)).toBe(out);
  });

  it('never uses exponent notation', () => {
    for (const n of [3.1e-7, 1e-9, 4.2e-12]) {
      expect(formatNumber(n)).not.toMatch(/e/i);
    }
  });

  it('keeps the leading zero', () => {
    expect(formatNumber(0.5)).toBe('0.5');
  });

  it('never leaves a trailing zero after a decimal point', () => {
    for (const n of [5, 24, 0.2, 2.5, 0.1, 10.1]) {
      expect(formatNumber(n)).not.toMatch(/\.\d*0$/);
    }
  });

  it('returns an em dash for non-finite input', () => {
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
  });
});

describe('formatRange', () => {
  it('shows a single value when min and max display the same', () => {
    expect(formatRange(5, 5, 'mg')).toBe('5 mg');
    expect(formatRange(0.2001, 0.2002, 'ml')).toBe('0.2 ml');
  });

  it('shows min–max otherwise', () => {
    expect(formatRange(5, 10, 'mg')).toBe('5–10 mg');
  });
});

describe('isRange', () => {
  it('is false when the displayed values match', () => {
    expect(isRange(5, 5)).toBe(false);
    expect(isRange(0.2001, 0.2002)).toBe(false);
  });

  it('is true when they differ', () => {
    expect(isRange(5, 10)).toBe(true);
  });
});

describe('formatConcentration', () => {
  it('renders strength, unit and form', () => {
    expect(formatConcentration({ id: 'a', value: 22.7, form: 'oral' }, 'mg')).toBe('22.7 mg/ml · oral');
  });

  it('appends the note when present', () => {
    expect(formatConcentration({ id: 'a', value: 22.7, form: 'oral', note: 'Baytril' }, 'mg'))
      .toBe('22.7 mg/ml · oral · Baytril');
  });

  it('uses thousands separators for IU strengths', () => {
    expect(formatConcentration({ id: 'a', value: 50000, form: 'injectable' }, 'IU'))
      .toBe('50,000 IU/ml · injectable');
  });
});

describe('formatUnitBadge', () => {
  it.each([['mg', 'mg'], ['IU', 'IU'], ['ml', 'ml/kg']] as const)('%s → %s', (u, out) => {
    expect(formatUnitBadge(u)).toBe(out);
  });
});

describe('plainDuration', () => {
  it('formats single and ranged durations', () => {
    expect(plainDuration(null)).toBeNull();
    expect(plainDuration({ min: 1, max: 1 })).toBe('1 day');
    expect(plainDuration({ min: 5, max: 5 })).toBe('5 days');
    expect(plainDuration({ min: 5, max: 7 })).toBe('5 to 7 days');
  });
});

describe('formatDosePerKg', () => {
  it('shows one value when min equals max', () => {
    expect(formatDosePerKg({ min: 0.2, typical: 0.2, max: 0.2 }, 'mg')).toBe('0.2 mg/kg');
  });
  it('shows the range and typical otherwise', () => {
    expect(formatDosePerKg({ min: 1000, typical: 1500, max: 2000 }, 'IU')).toBe('1,000–2,000 IU/kg (typ 1,500)');
  });
});
