import { describe, it, expect } from 'vitest';
import { isCurrentMedicationShape, assertRuleShape, SchemaMismatchError } from './schemaGuard';

describe('schema guard', () => {
  it('accepts a new-shape medication', () => {
    expect(isCurrentMedicationShape({ name: 'x', doseUnit: 'mg', concentrations: [] })).toBe(true);
  });

  it('rejects a medication without doseUnit', () => {
    expect(isCurrentMedicationShape({ name: 'x', concentrations: [] })).toBe(false);
  });

  it('accepts a new-shape rule', () => {
    expect(() => assertRuleShape('r1', { dosePerKg: { min: 1, typical: 1, max: 1 } })).not.toThrow();
  });

  it('rejects a rule that still has mgPerKg', () => {
    expect(() => assertRuleShape('r1', { mgPerKg: { min: 1, typical: 1, max: 1 } })).toThrow(SchemaMismatchError);
  });

  it('rejects a rule that has both shapes', () => {
    expect(() => assertRuleShape('r1', {
      dosePerKg: { min: 1, typical: 1, max: 1 }, mgPerKg: { min: 1, typical: 1, max: 1 },
    })).toThrow(SchemaMismatchError);
  });
});
