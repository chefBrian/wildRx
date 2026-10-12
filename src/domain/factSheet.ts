import { ROUTES } from './doseRoutes';
import { shadowedGroupRules } from './shadowing';
import { GROUPS, type DosingRule, type Route, type Species, type TaxonomicGroup } from './types';

export interface SpeciesBlock {
  species: Species;
  rules: DosingRule[];
  /** The species has its own rules, so the group's rules don't reach it (per med). */
  replacesGroup: boolean;
  /** Routes the group rules had that the species rules don't - this species has no dose for them. */
  lostRoutes: Route[];
}

export interface GroupSection {
  group: TaxonomicGroup;
  groupRules: DosingRule[];
  speciesBlocks: SpeciesBlock[];
}

export interface FactSheetRules {
  sections: GroupSection[];
  /** Rules for a species that no longer exists or a group that isn't known. Shown, never dropped. */
  other: DosingRule[];
}

/** Every rule for one medication, grouped for the public fact sheet. Pure. */
export function groupRulesForSheet(input: {
  rules: DosingRule[];
  species: Species[];
  medicationId: string;
}): FactSheetRules {
  const { species, medicationId } = input;
  const forMed = input.rules.filter(r => r.medicationId === medicationId);
  const placed = new Set<string>();
  const sections: GroupSection[] = [];
  for (const group of GROUPS) {
    const groupRules = byRoute(forMed.filter(r => r.target.type === 'group' && r.target.value === group));
    const speciesBlocks: SpeciesBlock[] = [];
    for (const s of species.filter(x => x.group === group).sort((a, b) => a.commonName.localeCompare(b.commonName))) {
      const own = byRoute(forMed.filter(r => r.target.type === 'species' && r.target.value === s.id));
      if (own.length === 0) continue;
      const hidden = shadowedGroupRules({ rules: forMed, species: s, medicationId });
      const ownRoutes = new Set(own.map(r => r.route));
      speciesBlocks.push({
        species: s,
        rules: own,
        replacesGroup: hidden.length > 0,
        lostRoutes: ROUTES.filter(r => hidden.some(h => h.route === r) && !ownRoutes.has(r)),
      });
      own.forEach(r => placed.add(r.id));
    }
    groupRules.forEach(r => placed.add(r.id));
    if (groupRules.length > 0 || speciesBlocks.length > 0) sections.push({ group, groupRules, speciesBlocks });
  }
  return { sections, other: forMed.filter(r => !placed.has(r.id)) };
}

function byRoute(rules: DosingRule[]): DosingRule[] {
  return [...rules].sort((a, b) => ROUTES.indexOf(a.route) - ROUTES.indexOf(b.route));
}
