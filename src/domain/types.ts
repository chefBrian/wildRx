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

export interface Species {
  id: string;
  commonName: string;
  scientificName: string;
  group: TaxonomicGroup;
  typicalWeightGrams: { min: number; max: number };
  notes?: string;
}

export interface Concentration {
  label: string;       // e.g. "1.5 mg/ml oral suspension"
  mgPerMl: number;
}

export type Route = 'PO' | 'IM' | 'SC' | 'IV' | 'topical';

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  concentrations: Concentration[];
  defaultRoute?: Route;
  notes?: string;
}

export type RuleTarget =
  | { type: 'group'; value: TaxonomicGroup }
  | { type: 'species'; value: string /* speciesId */ };

export interface DosingRule {
  id: string;
  medicationId: string;
  target: RuleTarget;
  mgPerKg: { min: number; max: number; typical: number };
  route: Route;
  frequency: string;            // "q12h", "q24h", "once"
  durationDays: { min: number; max: number } | null;
  maxSingleDoseMg: number | null;
  contraindications: string[];
  notes: string;
  updatedAt: number;            // epoch ms
  updatedBy: string;            // admin uid
}
