import { resolveRules } from './resolveRules';
import { groupRuleReach } from './shadowing';
import { formatGroup, type DosingRule, type Medication, type Species, type TaxonomicGroup } from './types';

/**
 * Extra confirm-dialog text for deleting `rule`: what the affected animals fall back to.
 * Computed with resolveRules on the rules without this one. null = nothing to add.
 */
export function deleteImpact(input: {
  rule: DosingRule;
  rules: DosingRule[];
  species: Species[];
  medName: string;
}): string | null {
  const { rule, rules, species, medName } = input;
  const remaining = rules.filter(r => r.id !== rule.id);
  if (rule.target.type === 'species') {
    const sp = species.find(s => s.id === rule.target.value);
    if (!sp) return null;
    const own = remaining.filter(r => r.medicationId === rule.medicationId
      && r.target.type === 'species' && r.target.value === sp.id);
    if (own.length > 0) {
      // Shadowing is per med: the species' other routes keep the group's rule for this route hidden.
      const hiddenForRoute = remaining.some(r => r.medicationId === rule.medicationId
        && r.target.type === 'group' && r.target.value === sp.group && r.route === rule.route);
      if (!hiddenForRoute) return null;
      return `${sp.commonName} will have no ${rule.route} rule for ${medName}. `
        + `The ${formatGroup(sp.group)} ${rule.route} rule stays hidden while it has its own ${joinRoutes(own)} ${plural('rule', own.length)}.`;
    }
    const after = resolveRules({ rules: remaining, species: sp, medicationId: rule.medicationId }).matched;
    if (after.length === 0) return `${sp.commonName} will have no rule for ${medName}.`;
    return `${sp.commonName} will fall back to the ${formatGroup(sp.group)} ${joinRoutes(after)} ${plural('rule', after.length)} for ${medName}.`;
  }
  const group = rule.target.value;
  const n = groupRuleReach({ rules, species, group, medicationId: rule.medicationId }).length;
  if (n === 0) return null;
  const head = `${n} species in ${formatGroup(group)} ${n === 1 ? 'uses' : 'use'} this rule`;
  const lastForGroup = !remaining.some(r => r.medicationId === rule.medicationId
    && r.target.type === 'group' && r.target.value === group);
  return lastForGroup ? `${head} and will have no rule for ${medName}.` : `${head}.`;
}

/**
 * Editor text before saving a new species rule that will hide group rules for the med.
 * Shadowing is per med, not per route, so a PO species rule also hides a group SC rule.
 */
export function overrideImpact(input: {
  rule: DosingRule;
  rules: DosingRule[];
  species: Species[];
}): string | null {
  const { rule, rules, species } = input;
  if (rule.target.type !== 'species') return null;
  const sp = species.find(s => s.id === rule.target.value);
  if (!sp) return null;
  const forMed = rules.filter(r => r.id !== rule.id && r.medicationId === rule.medicationId);
  if (forMed.some(r => r.target.type === 'species' && r.target.value === sp.id)) return null;
  const hidden = forMed.filter(r => r.target.type === 'group' && r.target.value === sp.group);
  if (hidden.length === 0) return null;
  return `Saving this hides the ${formatGroup(sp.group)} group's ${joinRoutes(hidden)} ${plural('rule', hidden.length)} for ${sp.commonName}.`;
}

/**
 * Editor text before moving a species to another group: group-sourced doses change
 * and some meds may lose every rule. null when no med's rules in effect change.
 */
export function groupChangeImpact(input: {
  species: Species;
  newGroup: TaxonomicGroup;
  meds: Medication[];
  rules: DosingRule[];
}): string | null {
  const { species, newGroup, meds, rules } = input;
  if (newGroup === species.group) return null;
  const moved: Species = { ...species, group: newGroup };
  let changed = 0;
  let lost = 0;
  for (const med of meds) {
    const before = inEffect(rules, species, med.id);
    const after = inEffect(rules, moved, med.id);
    if (before === after) continue;
    if (after === '') lost++;
    else changed++;
  }
  const parts: string[] = [];
  if (changed > 0) parts.push(`changes the dosing rules for ${changed} ${plural('med', changed)}`);
  if (lost > 0) parts.push(`leaves ${lost} ${plural('med', lost)} with no rule`);
  if (parts.length === 0) return null;
  return `Moving ${species.commonName} to ${formatGroup(newGroup)} ${parts.join(' and ')}.`;
}

/** "PO", "PO and SC", "PO, SC and IM" - unique routes in first-seen order. */
export function joinRoutes(rules: DosingRule[]): string {
  const routes = [...new Set(rules.map(r => r.route))];
  if (routes.length <= 1) return routes.join('');
  return `${routes.slice(0, -1).join(', ')} and ${routes[routes.length - 1]}`;
}

function inEffect(rules: DosingRule[], species: Species, medicationId: string): string {
  return resolveRules({ rules, species, medicationId }).matched.map(r => r.id).sort().join(',');
}

function plural(word: string, n: number): string {
  return n === 1 ? word : `${word}s`;
}
