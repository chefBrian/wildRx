import { describe, it, expect } from 'vitest';
import { ruleId as scriptRuleId } from './ruleId.mjs';
import { ruleId } from '../../src/domain/ruleId.ts';

const ROUTES = ['PO', 'IM', 'SC', 'IV', 'topical'];
const TARGETS = [
  { type: 'group', value: 'raptor' },
  { type: 'species', value: 'eastern-box-turtle' },
];

describe('ruleId', () => {
  it('formats group and species targets with the route', () => {
    expect(ruleId('meloxicam', { type: 'group', value: 'raptor' }, 'PO')).toBe('meloxicam__group-raptor__PO');
    expect(ruleId('meloxicam', { type: 'species', value: 'red-tailed-hawk' }, 'SC'))
      .toBe('meloxicam__species-red-tailed-hawk__SC');
  });

  it.each(ROUTES)('the scripts copy matches src for %s', route => {
    for (const target of TARGETS) {
      expect(scriptRuleId('m1', target, route)).toBe(ruleId('m1', target, route));
    }
  });
});
