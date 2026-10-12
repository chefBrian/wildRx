// src/domain/types.ts

export type TaxonomicGroup =
  | 'raptor'
  | 'songbird'
  | 'waterfowl'
  | 'wadingBird'
  | 'shorebird'
  | 'smallMammal'
  | 'mediumMammal'
  | 'largeMammal'
  | 'reptile'
  | 'amphibian'
  | 'other';

const GROUP_LABELS: Record<TaxonomicGroup, string> = {
  raptor: 'Raptor',
  songbird: 'Songbird',
  waterfowl: 'Waterfowl',
  wadingBird: 'Wading Bird',
  shorebird: 'Shorebird',
  smallMammal: 'Small Mammal',
  mediumMammal: 'Medium Mammal',
  largeMammal: 'Large Mammal',
  reptile: 'Reptile',
  amphibian: 'Amphibian',
  other: 'Other',
};

/** Every group, in display order. */
export const GROUPS = Object.keys(GROUP_LABELS) as TaxonomicGroup[];

export function formatGroup(g: TaxonomicGroup | string): string {
  return GROUP_LABELS[g as TaxonomicGroup] ?? g;
}

export interface Species {
  id: string;
  commonName: string;
  scientificName: string;
  group: TaxonomicGroup;
  typicalWeightKg: { min: number; max: number };
  notes?: string;
}

export type DoseUnit = 'mg' | 'IU' | 'ml';
export const DOSE_UNITS: DoseUnit[] = ['mg', 'IU', 'ml'];

export type ConcentrationForm = 'injectable' | 'oral' | 'topical' | 'other';
export const CONCENTRATION_FORMS: ConcentrationForm[] = ['injectable', 'oral', 'topical', 'other'];

export interface Concentration {
  id: string;              // stable within the med; carried in ?conc=
  value: number;           // strength per ml, in `${med.doseUnit}/ml`
  form: ConcentrationForm;
  /** Routes this bottle may be given by. Always written by current code (non-empty, ROUTES order);
   *  optional because stored docs may predate it - read through allowedRoutes(), never directly. */
  routes?: Route[];
  note?: string;           // e.g. "Baytril", "in-house dilution" - never a strength
}

export type Route = 'PO' | 'IM' | 'SC' | 'IV' | 'topical';

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  doseUnit: DoseUnit;
  concentrations: Concentration[];   // always [] when doseUnit === 'ml'
  productDescription?: string;       // required when doseUnit === 'ml'
  defaultRoute?: Route;
  notes?: string;
  schemaVersion?: number;            // current code always writes 2; firestore.rules requires it
}

export type RuleTarget =
  | { type: 'group'; value: TaxonomicGroup }
  | { type: 'species'; value: string /* speciesId */ };

export interface DosingRule {
  id: string;
  medicationId: string;
  target: RuleTarget;
  dosePerKg: { min: number; max: number; typical: number };  // per dose, in med.doseUnit per kg
  route: Route;
  frequency: string;            // "q12h", "q24h", "once"
  durationDays: { min: number; max: number } | null;
  maxSingleDose: number | null;                                // in med.doseUnit
  contraindications: string[];
  notes: string;
  updatedAt: number;            // epoch ms
  updatedBy: string;            // admin uid
}
