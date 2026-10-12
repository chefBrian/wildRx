import { describe, it, expect } from 'vitest';
import { findOrphans, planRuleRekeys, writeGate } from './migrateRuleIds.mjs';

const data = (medicationId, target, route) => ({ medicationId, target, route, dosePerKg: { min: 1, typical: 1, max: 1 } });
const raptor = { type: 'group', value: 'raptor' };

describe('planRuleRekeys', () => {
  it('re-keys a legacy id to the route-aware id', () => {
    const plan = planRuleRekeys([{ id: 'melox__group-raptor', data: data('melox', raptor, 'PO') }]);
    expect(plan.rekeys).toEqual([{ oldId: 'melox__group-raptor', newId: 'melox__group-raptor__PO' }]);
    expect(plan.problems).toEqual([]);
  });

  it('re-keys a random UUID id', () => {
    const plan = planRuleRekeys([{ id: '3f2a9c1e-uuid', data: data('melox', { type: 'species', value: 'rth' }, 'IM') }]);
    expect(plan.rekeys).toEqual([{ oldId: '3f2a9c1e-uuid', newId: 'melox__species-rth__IM' }]);
  });

  it('skips docs already at the right id', () => {
    const plan = planRuleRekeys([{ id: 'melox__group-raptor__PO', data: data('melox', raptor, 'PO') }]);
    expect(plan.alreadyCorrect).toEqual(['melox__group-raptor__PO']);
    expect(plan.rekeys).toEqual([]);
  });

  it('reports a conflict when the new id is taken by an existing doc', () => {
    const plan = planRuleRekeys([
      { id: 'melox__group-raptor__PO', data: data('melox', raptor, 'PO') },
      { id: 'legacy', data: data('melox', raptor, 'PO') },
    ]);
    expect(plan.rekeys).toEqual([]);
    expect(plan.problems).toEqual(['legacy: new id melox__group-raptor__PO is already taken by an existing doc']);
  });

  it('reports a conflict when two docs map to the same new id', () => {
    const plan = planRuleRekeys([
      { id: 'a', data: data('melox', raptor, 'PO') },
      { id: 'b', data: data('melox', raptor, 'PO') },
    ]);
    expect(plan.rekeys).toEqual([]);
    expect(plan.problems).toEqual(['a, b: all map to melox__group-raptor__PO']);
  });

  it.each([
    ['no route', { medicationId: 'melox', target: raptor }],
    ['unknown route', data('melox', raptor, 'oral')],
    ['no target', { medicationId: 'melox', route: 'PO' }],
    ['no target value', data('melox', { type: 'group' }, 'PO')],
    ['no medicationId', { target: raptor, route: 'PO' }],
  ])('reports a doc with %s', (_label, d) => {
    const plan = planRuleRekeys([{ id: 'x', data: d }]);
    expect(plan.problems).toEqual(['x: missing or invalid medicationId, target or route - fix by hand']);
    expect(plan.rekeys).toEqual([]);
  });
});

describe('writeGate', () => {
  it('allows --write only when the plan is clean', () => {
    expect(writeGate({ rekeys: [], alreadyCorrect: [], problems: [] })).toBeNull();
    expect(writeGate({ rekeys: [], alreadyCorrect: [], problems: ['x: bad'] }))
      .toBe('Refusing --write: 1 problem(s). Fix them by hand and re-run the dry run until it is clean.');
  });
});

describe('findOrphans', () => {
  const known = { speciesIds: new Set(['rth']), medIds: new Set(['melox']) };

  it('reports rules for a missing species or medication', () => {
    expect(findOrphans([
      { id: 'ok', data: data('melox', { type: 'species', value: 'rth' }, 'PO') },
      { id: 'gone-species', data: data('melox', { type: 'species', value: 'deleted-hawk' }, 'PO') },
      { id: 'gone-med', data: data('nope', raptor, 'PO') },
      { id: 'group-ok', data: data('melox', raptor, 'PO') },
    ], known)).toEqual([
      'gone-species: species deleted-hawk not found',
      'gone-med: medication nope not found',
    ]);
  });
});
