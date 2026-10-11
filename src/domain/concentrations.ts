import type { Concentration, Medication } from './types';

export type ConcentrationChoice =
  | { status: 'none' }
  | { status: 'selected'; concentration: Concentration }
  | { status: 'needsPick' };

/**
 * Resolve ?conc=<id>. Never silently picks a strength when the med has several:
 * a missing or unknown id (including old index-style links) means "go pick".
 */
export function resolveConcentration(med: Medication, concId: string | null): ConcentrationChoice {
  if (med.doseUnit === 'ml' || med.concentrations.length === 0) return { status: 'none' };
  if (med.concentrations.length === 1) return { status: 'selected', concentration: med.concentrations[0] };
  const match = med.concentrations.find(c => c.id === concId);
  return match ? { status: 'selected', concentration: match } : { status: 'needsPick' };
}
