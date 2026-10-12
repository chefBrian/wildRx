import { describe, it, expect } from 'vitest';
import { deleteImpact, groupChangeImpact, joinRoutes, overrideImpact } from './ruleImpact';
import type { DosingRule, RuleTarget, Species } from './types';

const sp = (id: string, commonName: string, group: Species['group']): Species => ({
  id, commonName, scientificName: '', group, typicalWeightKg: { min: 1, max: 2 },
});
const hawk = sp('rth', 'Red-tailed Hawk', 'raptor');
const owl = sp('bo', 'Barred Owl', 'raptor');
const species = [hawk, owl];
const rule = (id: string, medicationId: string, target: RuleTarget, route: DosingRule['route'] = 'PO'): DosingRule => ({
  id, medicationId, target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});
const groupPO = rule('gpo', 'melox', { type: 'group', value: 'raptor' }, 'PO');
const groupSC = rule('gsc', 'melox', { type: 'group', value: 'raptor' }, 'SC');
const hawkPO = rule('hpo', 'melox', { type: 'species', value: 'rth' }, 'PO');
const hawkIM = rule('him', 'melox', { type: 'species', value: 'rth' }, 'IM');

describe('joinRoutes', () => {
  it('joins unique routes in order', () => {
    expect(joinRoutes([groupPO])).toBe('PO');
    expect(joinRoutes([groupPO, groupSC])).toBe('PO and SC');
    expect(joinRoutes([groupPO, groupSC, hawkIM, hawkPO])).toBe('PO, SC and IM');
  });
});

describe('deleteImpact', () => {
  it('says a species falls back to the group rules when its last rule goes', () => {
    expect(deleteImpact({ rule: hawkPO, rules: [groupPO, groupSC, hawkPO], species, medName: 'Meloxicam' }))
      .toBe('Red-tailed Hawk will fall back to the Raptor PO and SC rules for Meloxicam.');
  });

  it('says a species will have no rule when there is no group rule to fall back to', () => {
    expect(deleteImpact({ rule: hawkPO, rules: [hawkPO], species, medName: 'Meloxicam' }))
      .toBe('Red-tailed Hawk will have no rule for Meloxicam.');
  });

  it('warns that the group rule for the route stays hidden when the species keeps another route', () => {
    expect(deleteImpact({ rule: hawkPO, rules: [groupPO, hawkPO, hawkIM], species, medName: 'Meloxicam' }))
      .toBe('Red-tailed Hawk will have no PO rule for Meloxicam. The Raptor PO rule stays hidden while it has its own IM rule.');
  });

  it('adds nothing when the species keeps another route and the group has no rule for this one', () => {
    expect(deleteImpact({ rule: hawkPO, rules: [groupSC, hawkPO, hawkIM], species, medName: 'Meloxicam' })).toBeNull();
  });

  it('counts the species a group rule reaches', () => {
    expect(deleteImpact({ rule: groupPO, rules: [groupPO, groupSC, hawkPO], species, medName: 'Meloxicam' }))
      .toBe('1 species in Raptor uses this rule.');
  });

  it("warns when it is the group's last rule for the med", () => {
    expect(deleteImpact({ rule: groupPO, rules: [groupPO], species, medName: 'Meloxicam' }))
      .toBe('2 species in Raptor use this rule and will have no rule for Meloxicam.');
  });

  it('adds nothing for a group rule no species uses', () => {
    expect(deleteImpact({ rule: groupPO, rules: [groupPO], species: [], medName: 'Meloxicam' })).toBeNull();
  });
});

describe('overrideImpact', () => {
  const draft = rule('', 'melox', { type: 'species', value: 'rth' }, 'IM');

  it('names the group rules a first species rule will hide', () => {
    expect(overrideImpact({ rule: draft, rules: [groupPO, groupSC], species }))
      .toBe("Saving this hides the Raptor group's PO and SC rules for Red-tailed Hawk.");
  });

  it('is null when the species already has its own rule for the med', () => {
    expect(overrideImpact({ rule: draft, rules: [groupPO, hawkPO], species })).toBeNull();
  });

  it('is null when there are no group rules to hide', () => {
    expect(overrideImpact({ rule: draft, rules: [], species })).toBeNull();
  });

  it('is null for a group-target draft', () => {
    expect(overrideImpact({ rule: { ...draft, target: { type: 'group', value: 'raptor' } }, rules: [groupPO], species })).toBeNull();
  });
});

describe('groupChangeImpact', () => {
  const med = (id: string) => ({ id, name: id, doseUnit: 'mg' as const, concentrations: [] });
  const meds = [med('melox'), med('baytril'), med('prazi')];
  // melox: hawk has its own rule, so a group move doesn't touch it.
  // baytril: raptor group rule only → lost when moving to songbird.
  // prazi: raptor and songbird group rules → changes.
  const rules = [
    hawkPO,
    rule('b', 'baytril', { type: 'group', value: 'raptor' }),
    rule('p1', 'prazi', { type: 'group', value: 'raptor' }),
    rule('p2', 'prazi', { type: 'group', value: 'songbird' }),
  ];

  it('counts meds whose rules change and meds left with none', () => {
    expect(groupChangeImpact({ species: hawk, newGroup: 'songbird', meds, rules }))
      .toBe('Moving Red-tailed Hawk to Songbird changes the dosing rules for 1 med and leaves 1 med with no rule.');
  });

  it('only mentions what applies', () => {
    expect(groupChangeImpact({ species: hawk, newGroup: 'songbird', meds: [med('prazi')], rules }))
      .toBe('Moving Red-tailed Hawk to Songbird changes the dosing rules for 1 med.');
    expect(groupChangeImpact({ species: hawk, newGroup: 'songbird', meds: [med('baytril')], rules }))
      .toBe('Moving Red-tailed Hawk to Songbird leaves 1 med with no rule.');
  });

  it('is null when nothing changes or the group is the same', () => {
    expect(groupChangeImpact({ species: hawk, newGroup: 'songbird', meds: [med('melox')], rules })).toBeNull();
    expect(groupChangeImpact({ species: hawk, newGroup: 'raptor', meds, rules })).toBeNull();
  });
});
