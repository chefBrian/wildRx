import { describe, it, expect } from 'vitest';
import {
  parseForm, noteFromLabel, migrateMedication, migrateRule, ruleFlags, NOTE_STRENGTH, UNIT_HINT,
} from './migrateDoseUnits.mjs';
import { STRENGTH_IN_TEXT } from '../../src/domain/validate.ts';

let n = 0;
const makeId = () => `id${++n}`;

describe('parseForm', () => {
  it.each([
    ['100 mg/ml injectable', 'injectable'],
    ['50 mg/ml injectable suspension', 'injectable'],
    ['22.7 mg/ml oral suspension (Baytril)', 'oral'],
    ['25 mg/ml compounded suspension', 'oral'],
    ['2 mg/ml compounded oral', 'oral'],
    ['10 mg/ml oral solution', 'oral'],
    ['62.5 mg/ml drops (Clavamox)', 'other'],
    ['1% ointment', 'topical'],
    ['15 mg/ml concentrated (OP toxicity)', 'other'],
    ['50mg/ml', 'other'],
    ['', 'other'],
    ['0.3% ophthalmic solution', 'other'],
    ['otic suspension', 'other'],
  ])('%j → %s', (label, form) => {
    expect(parseForm(label)).toBe(form);
  });
});

describe('noteFromLabel', () => {
  it.each([
    ['22.7 mg/ml oral suspension (Baytril)', 'Baytril'],
    ['100 mg/ml injectable', undefined],
    ['56.8 mg/ml injectable (Droncit)', 'Droncit'],
    ['25 mg/ml compounded suspension', 'compounded'],
    ['2 mg/ml compounded oral', 'compounded'],
    ['48 mg/ml suspension (40 SMX + 8 TMP)', '40 SMX + 8 TMP'],
    ['10 mg/ml injectable 1% (Ivomec)', '1% (Ivomec)'],
    ['1 mg/ml diluted for small patients', 'diluted for small patients'],
    ['15 mg/ml concentrated (OP toxicity)', 'concentrated (OP toxicity)'],
    ['62.5 mg/ml drops (Clavamox)', 'drops (Clavamox)'],
    ['50mg/ml', undefined],
    [' 1.5 mg/ml', undefined],
    ['', undefined],
  ])('%j → %j', (label, note) => {
    expect(noteFromLabel(label)).toBe(note);
  });
});

describe('NOTE_STRENGTH', () => {
  it('matches the app validation regex exactly', () => {
    expect(NOTE_STRENGTH.source).toBe(STRENGTH_IN_TEXT.source);
    expect(NOTE_STRENGTH.flags).toBe(STRENGTH_IN_TEXT.flags);
  });
});

describe('UNIT_HINT', () => {
  it.each([
    'Vitamin A', 'Vitamin D3', 'Vitamin E', 'Vit E', 'vit. A', 'E-Se', 'Bo-Se', 'selenium',
    'Penicillin G', 'insulin', 'heparin', 'oxytocin', 'Pepto-Bismol', 'Pedialyte', 'LRS',
    "Lactated Ringer's", 'Normosol-R', 'Plasma-Lyte A', '5% dextrose', 'NaCl', '0.9% saline',
    'lactulose', '5000 IU', '10 units',
  ])('flags %j', text => {
    expect(UNIT_HINT.test(text)).toBe(true);
  });

  it.each(['Vitamin K1', 'Meloxicam', 'Enrofloxacin', 'Ivermectin', 'Carprofen'])('does not flag %j', text => {
    expect(UNIT_HINT.test(text)).toBe(false);
  });
});

describe('migrateMedication', () => {
  it('converts concentrations and sets doseUnit mg', () => {
    const r = migrateMedication({
      name: 'Enrofloxacin',
      concentrations: [
        { label: '22.7 mg/ml oral suspension (Baytril)', mgPerMl: 22.7 },
        { label: '100 mg/ml injectable', mgPerMl: 100 },
      ],
    }, makeId);
    expect(r.data.doseUnit).toBe('mg');
    expect(r.data.concentrations).toEqual([
      { id: expect.any(String), value: 22.7, form: 'oral', note: 'Baytril' },
      { id: expect.any(String), value: 100, form: 'injectable' },
    ]);
  });

  it('removes tablets and flags them', () => {
    const r = migrateMedication({
      name: 'Praziquantel',
      concentrations: [
        { label: '56.8 mg/ml injectable (Droncit)', mgPerMl: 56.8 },
        { label: '34 mg tablet (cat)', mgPerMl: 34 },
      ],
    }, makeId);
    expect(r.data.concentrations).toHaveLength(1);
    expect(r.flags.some(f => /removed tablet/.test(f))).toBe(true);
  });

  it('drops zero-strength concentrations and flags them', () => {
    const r = migrateMedication({
      name: 'Meloxicam',
      concentrations: [{ label: ' 1.5 mg/ml', mgPerMl: 0 }, { label: '', mgPerMl: 0 }],
    }, makeId);
    expect(r.data.concentrations).toEqual([]);
    expect(r.flags.filter(f => /dropped zero strength/.test(f))).toHaveLength(2);
  });

  it('flags other forms and notes that state a strength', () => {
    const r = migrateMedication({
      name: 'Mixed',
      concentrations: [
        { label: '62.5 mg/ml drops (Clavamox)', mgPerMl: 62.5 },
        { label: '10 mg/ml injectable 1% (Ivomec)', mgPerMl: 10 },
      ],
    }, makeId);
    expect(r.flags.some(f => /form parsed as other/.test(f))).toBe(true);
    expect(r.flags.some(f => /note contains a strength/.test(f))).toBe(true);
  });

  it('flags meds that look IU- or ml-dosed', () => {
    const r = migrateMedication({ name: 'Vitamin D3', concentrations: [] }, makeId);
    expect(r.flags.some(f => /check unit/.test(f))).toBe(true);
  });

  it('flags a label strength that disagrees with the number', () => {
    const r = migrateMedication({
      name: 'X', concentrations: [{ label: '5 mg/ml injectable', mgPerMl: 50 }],
    }, makeId);
    expect(r.flags).toContain('label strength 5 disagrees with number 50 - confirm the bottle: "5 mg/ml injectable"');
  });

  it.each([
    ['22.7 mg/ml oral suspension (Baytril)', 22.7],
    ['50mg/ml', 50],
    ['drops (Clavamox)', 62.5],
  ])('does not flag a strength disagreement for %j', (label, mgPerMl) => {
    const r = migrateMedication({ name: 'X', concentrations: [{ label, mgPerMl }] }, makeId);
    expect(r.flags.some(f => /disagrees/.test(f))).toBe(false);
  });

  it('returns a before and after line for every migrated concentration', () => {
    const r = migrateMedication({
      name: 'Enrofloxacin',
      concentrations: [
        { label: '22.7 mg/ml oral suspension (Baytril)', mgPerMl: 22.7 },
        { label: '100 mg/ml injectable', mgPerMl: 100 },
        { label: '34 mg tablet', mgPerMl: 34 },
      ],
    }, makeId);
    expect(r.lines).toEqual([
      '"22.7 mg/ml oral suspension (Baytril)" (mgPerMl 22.7) → 22.7 mg/ml · oral · Baytril',
      '"100 mg/ml injectable" (mgPerMl 100) → 100 mg/ml · injectable',
    ]);
  });

  it('skips already-migrated docs', () => {
    expect(migrateMedication({ name: 'x', doseUnit: 'mg', concentrations: [] }, makeId)).toBeNull();
  });

  it('keeps unrelated fields and writes no undefined values', () => {
    const r = migrateMedication({
      name: 'Meloxicam',
      genericName: 'Meloxicam',
      notes: 'NSAID.',
      defaultRoute: 'PO',
      concentrations: [
        { label: '1.5 mg/ml oral suspension (Metacam)', mgPerMl: 1.5 },
        { label: '5 mg/ml injectable', mgPerMl: 5 },
      ],
    }, makeId);
    expect(r.data).toMatchObject({ name: 'Meloxicam', genericName: 'Meloxicam', notes: 'NSAID.', defaultRoute: 'PO' });
    expect(hasUndefined(r.data)).toBe(false);
  });
});

describe('migrateRule', () => {
  it('renames dose fields and drops the old ones', () => {
    const r = migrateRule({ medicationId: 'm', mgPerKg: { min: 1, typical: 2, max: 3 }, maxSingleDoseMg: 5 });
    expect(r).toEqual({ medicationId: 'm', dosePerKg: { min: 1, typical: 2, max: 3 }, maxSingleDose: 5 });
  });

  it('keeps target, route, frequency, durations, contraindications, notes and audit fields', () => {
    const r = migrateRule({
      id: 'r1',
      medicationId: 'm',
      target: { type: 'group', value: 'raptor' },
      mgPerKg: { min: 1, typical: 2, max: 3 },
      route: 'PO',
      frequency: 'q24h',
      durationDays: { min: 1, max: 5 },
      contraindications: ['Dehydration'],
      maxSingleDoseMg: 50,
      notes: 'n',
      updatedAt: 1,
      updatedBy: 'seed-script',
    });
    expect(r).toEqual({
      id: 'r1',
      medicationId: 'm',
      target: { type: 'group', value: 'raptor' },
      dosePerKg: { min: 1, typical: 2, max: 3 },
      route: 'PO',
      frequency: 'q24h',
      durationDays: { min: 1, max: 5 },
      contraindications: ['Dehydration'],
      maxSingleDose: 50,
      notes: 'n',
      updatedAt: 1,
      updatedBy: 'seed-script',
    });
  });

  it('defaults a missing cap to null', () => {
    expect(migrateRule({ mgPerKg: { min: 1, typical: 1, max: 1 } }).maxSingleDose).toBeNull();
  });

  it('skips already-migrated docs', () => {
    expect(migrateRule({ dosePerKg: { min: 1, typical: 1, max: 1 } })).toBeNull();
  });
});

describe('ruleFlags', () => {
  const ok = { route: 'PO', dosePerKg: { min: 1, typical: 2, max: 3 }, maxSingleDose: null };

  it('passes a clean rule', () => {
    expect(ruleFlags(ok, ['oral'])).toEqual([]);
  });

  it.each([
    [{ dosePerKg: { min: 1, typical: 0, max: 3 } }, /typical/],
    [{ dosePerKg: { min: 0, typical: 2, max: 3 } }, /min/],
    [{ dosePerKg: { min: 3, typical: 2, max: 3 } }, /min/],
    [{ dosePerKg: { min: 1, typical: 2, max: 1 } }, /max below typical/],
    [{ maxSingleDose: 0 }, /max single dose/],
  ])('flags %j', (patch, re) => {
    expect(ruleFlags({ ...ok, ...patch }, ['oral']).some(f => re.test(f))).toBe(true);
  });

  it('flags an injection-route rule on a med with no injectable concentration', () => {
    expect(ruleFlags({ ...ok, route: 'IM' }, ['oral']).some(f => /no injectable/.test(f))).toBe(true);
  });

  it('does not flag the route when the med has an injectable or is unknown/ml', () => {
    expect(ruleFlags({ ...ok, route: 'IM' }, ['oral', 'injectable'])).toEqual([]);
    expect(ruleFlags({ ...ok, route: 'IM' }, null)).toEqual([]);
    expect(ruleFlags({ ...ok, route: 'IM' }, undefined)).toEqual([]);
  });
});

function hasUndefined(value) {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === 'object') return Object.values(value).some(hasUndefined);
  return false;
}
