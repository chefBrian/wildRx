import { describe, it, expect } from 'vitest';
import { calculateDose } from './dose';
import type { Concentration, DosingRule } from './types';

const rule: DosingRule = {
  id: 'r1',
  medicationId: 'm1',
  target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 0.1, max: 0.5, typical: 0.2 },
  route: 'PO',
  frequency: 'q24h',
  durationDays: null,
  maxSingleDose: null,
  contraindications: [],
  notes: '',
  updatedAt: 0,
  updatedBy: '',
};

const conc = (value: number): Concentration => ({ id: 'c1', value, form: 'oral' });

describe('calculateDose — mg', () => {
  it('computes typical, min, max for a 1 kg animal', () => {
    const r = calculateDose({ weightKg: 1, rule, doseUnit: 'mg' });
    expect(r.dose.typical).toBeCloseTo(0.2);
    expect(r.dose.min).toBeCloseTo(0.1);
    expect(r.dose.max).toBeCloseTo(0.5);
    expect(r.unit).toBe('mg');
  });

  it('scales linearly with weight', () => {
    const r = calculateDose({ weightKg: 2.5, rule, doseUnit: 'mg' });
    expect(r.dose.typical).toBeCloseTo(0.5);
  });

  it('returns volumeMl when a concentration is provided', () => {
    const r = calculateDose({ weightKg: 1, rule, doseUnit: 'mg', concentration: conc(1) });
    expect(r.volumeMl?.typical).toBeCloseTo(0.2);
  });

  it('omits volumeMl when no concentration is provided', () => {
    const r = calculateDose({ weightKg: 1, rule, doseUnit: 'mg' });
    expect(r.volumeMl).toBeUndefined();
  });

  it('omits volumeMl when the concentration value is 0', () => {
    const r = calculateDose({ weightKg: 1, rule, doseUnit: 'mg', concentration: conc(0) });
    expect(r.volumeMl).toBeUndefined();
  });
});

describe('calculateDose — IU', () => {
  const iuRule: DosingRule = { ...rule, dosePerKg: { min: 1000, typical: 1500, max: 2000 } };

  it('computes dose in IU and volume from an IU/ml concentration', () => {
    const r = calculateDose({ weightKg: 0.5, rule: iuRule, doseUnit: 'IU', concentration: conc(50000) });
    expect(r.unit).toBe('IU');
    expect(r.dose.typical).toBeCloseTo(750);
    expect(r.volumeMl?.typical).toBeCloseTo(0.015);
  });

  it('caps in IU', () => {
    const r = calculateDose({ weightKg: 1, rule: { ...iuRule, maxSingleDose: 1200 }, doseUnit: 'IU' });
    expect(r.dose.typical).toBe(1200);
    expect(r.typicalCapped).toBe(true);
  });
});

describe('calculateDose — ml', () => {
  const mlRule: DosingRule = { ...rule, dosePerKg: { min: 0.5, typical: 1, max: 2 } };

  it('treats the dose as the volume', () => {
    const r = calculateDose({ weightKg: 0.2, rule: mlRule, doseUnit: 'ml' });
    expect(r.unit).toBe('ml');
    expect(r.dose.typical).toBeCloseTo(0.2);
    expect(r.volumeMl?.typical).toBeCloseTo(0.2);
  });

  it('ignores a concentration even if one is passed', () => {
    const r = calculateDose({ weightKg: 0.2, rule: mlRule, doseUnit: 'ml', concentration: conc(50) });
    expect(r.volumeMl?.typical).toBeCloseTo(0.2);
  });

  it('caps in ml', () => {
    const r = calculateDose({ weightKg: 10, rule: { ...mlRule, maxSingleDose: 5 }, doseUnit: 'ml' });
    expect(r.volumeMl?.typical).toBe(5);
  });
});

describe('calculateDose — max single dose flags', () => {
  const capped: DosingRule = { ...rule, maxSingleDose: 0.3 };

  it('caps typical dose when over max', () => {
    const r = calculateDose({ weightKg: 5, rule: capped, doseUnit: 'mg' });
    expect(r.dose.typical).toBeCloseTo(0.3);
    expect(r.cappedByMaxDose).toBe(true);
    expect(r.typicalCapped).toBe(true);
  });

  it('does not cap when everything is below max', () => {
    const r = calculateDose({ weightKg: 0.5, rule: capped, doseUnit: 'mg' });
    expect(r.cappedByMaxDose).toBe(false);
    expect(r.typicalCapped).toBe(false);
  });

  it('flags a cap that only affects the top of the range', () => {
    // 1 kg: min 0.1, typical 0.2, max 0.5 → cap 0.3 only bites max.
    const r = calculateDose({ weightKg: 1, rule: capped, doseUnit: 'mg' });
    expect(r.dose.max).toBeCloseTo(0.3);
    expect(r.cappedByMaxDose).toBe(true);
    expect(r.typicalCapped).toBe(false);
  });

  it('flags cap when legacy min exceeds max', () => {
    // Pre-validation data can have min > max; the banner must still fire.
    const legacy: DosingRule = { ...rule, dosePerKg: { min: 0.6, typical: 0.2, max: 0.1 }, maxSingleDose: 0.3 };
    const r = calculateDose({ weightKg: 1, rule: legacy, doseUnit: 'mg' });
    expect(r.cappedByMaxDose).toBe(true);
  });
});
