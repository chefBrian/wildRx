import type { Concentration, ConcentrationForm, Medication, Route } from './types';
import { ROUTES } from './doseRoutes';

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

/** Defaults for a form. IV is never a default - it must be ticked deliberately. */
export const DEFAULT_ROUTES: Record<ConcentrationForm, readonly Route[]> = {
  injectable: ['PO', 'IM', 'SC'],
  oral: ['PO'],
  topical: ['topical'],
  other: [],
};

/** Routes a bottle allows, as a fresh array. A doc without `routes` (old admin build,
 *  pre-migration) gets its form's defaults - never "unrestricted". */
export function allowedRoutes(c: Concentration): Route[] {
  return [...(c.routes ?? DEFAULT_ROUTES[c.form] ?? [])];
}

export function bottleAllowsRoute(c: Concentration, route: Route): boolean {
  return allowedRoutes(c).includes(route);
}

/** "IM, SC" for UI text. */
export function formatRoutes(routes: readonly Route[]): string {
  return routes.length > 0 ? routes.join(', ') : 'no routes';
}

/** Deduped, in ROUTES order - the stored shape. */
export function normalizeRoutes(routes: readonly Route[]): Route[] {
  return ROUTES.filter(r => routes.includes(r));
}
