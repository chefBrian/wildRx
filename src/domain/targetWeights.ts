import type { RuleTarget, Species } from './types';

/** Typical weight span for a rule target, from species data. null when no species match. */
export function targetWeightRange(
  target: RuleTarget,
  species: Species[],
): { min: number; max: number } | null {
  const matching = target.type === 'species'
    ? species.filter(s => s.id === target.value)
    : species.filter(s => s.group === target.value);
  if (matching.length === 0) return null;
  return {
    min: Math.min(...matching.map(s => s.typicalWeightKg.min)),
    max: Math.max(...matching.map(s => s.typicalWeightKg.max)),
  };
}
