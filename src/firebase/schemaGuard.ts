// Old-shape docs (pre dose-units migration) must never reach the dose math.
// Firestore rules block new old-shape writes; this is the client-side backstop.

export class SchemaMismatchError extends Error {
  constructor(collection: string, id: string) {
    super(`Old-shape ${collection} doc ${id} - data update in progress`);
    this.name = 'SchemaMismatchError';
  }
}

export function isCurrentMedicationShape(data: Record<string, unknown>): boolean {
  return 'doseUnit' in data;
}

export function assertRuleShape(id: string, data: Record<string, unknown>): void {
  if ('mgPerKg' in data || !('dosePerKg' in data)) throw new SchemaMismatchError('dosingRules', id);
}
