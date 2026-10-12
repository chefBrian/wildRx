import type { Route, RuleTarget } from './types';

/**
 * Load-bearing doc id for dosingRules: one rule per med + target + route.
 * Mirrored in scripts/lib/ruleId.mjs (a test pins the two) and firestore.rules.
 */
export function ruleId(medId: string, target: RuleTarget, route: Route): string {
  return `${medId}__${target.type}-${target.value}__${route}`;
}
