import type {
  Concentration, ConcentrationForm, DoseUnit, DosingRule, Medication,
} from './types';
import { normalizeRoutes } from './concentrations';

export type FieldErrors = Record<string, string>;

/** Admin edit state: unit and form start unchosen so nothing defaults silently. */
export type ConcentrationDraft = Omit<Concentration, 'form'> & { form: ConcentrationForm | '' };
export type MedicationDraft = Omit<Medication, 'doseUnit' | 'concentrations'> & {
  doseUnit: DoseUnit | null;
  concentrations: ConcentrationDraft[];
};

// A number followed by a unit. Notes must never state a strength - the strength
// lives in the numeric field so the math and the displayed text can't disagree.
// (?![a-z]) instead of \b so "1%" matches. Keep in sync with NOTE_STRENGTH in
// scripts/lib/migrateDoseUnits.mjs - a test there pins the two together.
export const STRENGTH_IN_TEXT = /\d+(\.\d+)?\s*(mg|mgs|milligrams?|mcgs?|micrograms?|[uµμ]g|grams?|g|ml|iu|units?|%)(?![a-z])/i;

export function validateMedication(med: MedicationDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!med.name.trim()) errors.name = 'Name is required.';
  if (med.doseUnit === null) {
    errors.doseUnit = 'Choose what this medication is dosed in.';
  } else if (med.doseUnit === 'ml') {
    if (med.concentrations.length > 0) errors.concentrations = 'ml medications have no concentrations.';
    if (!med.productDescription?.trim()) errors.productDescription = 'Name the exact product and strength.';
  } else {
    med.concentrations.forEach((c, i) => {
      if (!(Number.isFinite(c.value) && c.value > 0)) errors[`conc.${i}.value`] = 'Enter a strength above 0.';
      if (c.form === '') errors[`conc.${i}.form`] = 'Choose a form.';
      if (!c.routes || c.routes.length === 0) errors[`conc.${i}.routes`] = 'Choose at least one route.';
      if (c.note && STRENGTH_IN_TEXT.test(c.note)) {
        errors[`conc.${i}.note`] = 'Put the strength in the number field, not the note.';
      }
    });
  }
  return errors;
}

export function validateRule(rule: DosingRule): FieldErrors {
  const errors: FieldErrors = {};
  const { min, typical, max } = rule.dosePerKg;
  if (!(Number.isFinite(typical) && typical > 0)) errors.typical = 'Typical dose must be above 0.';
  if (!(Number.isFinite(min) && min > 0 && min <= typical)) {
    errors.min = 'Min must be above 0 and no more than typical.';
  }
  if (!(Number.isFinite(max) && max >= typical)) errors.max = 'Max must be at least typical.';
  const cap = rule.maxSingleDose;
  if (cap !== null && !(Number.isFinite(cap) && cap > 0)) {
    errors.maxSingleDose = 'Max single dose must be above 0, or blank.';
  }
  return errors;
}

/** A blank (0 or NaN) min or max means "no range given" - use typical. */
export function normalizeRuleRange(rule: DosingRule): DosingRule {
  const { min, typical, max } = rule.dosePerKg;
  const fill = (v: number) => (Number.isFinite(v) && v > 0 ? v : typical);
  return { ...rule, dosePerKg: { min: fill(min), typical, max: fill(max) } };
}

/** Convert a validated draft to the stored shape. Omits empty optional text (Firestore rejects undefined). */
export function toMedication(draft: MedicationDraft): Medication {
  if (draft.doseUnit === null) throw new Error('toMedication: doseUnit not chosen');
  const { doseUnit } = draft;
  const med: Medication = {
    id: draft.id,
    name: draft.name.trim(),
    doseUnit,
    schemaVersion: 2,
    concentrations: doseUnit === 'ml' ? [] : draft.concentrations.map(toConcentration),
  };
  const generic = draft.genericName?.trim();
  if (generic) med.genericName = generic;
  const product = draft.productDescription?.trim();
  if (doseUnit === 'ml' && product) med.productDescription = product;
  if (draft.defaultRoute) med.defaultRoute = draft.defaultRoute;
  const notes = draft.notes?.trim();
  if (notes) med.notes = notes;
  return med;
}

function toConcentration(c: ConcentrationDraft): Concentration {
  if (c.form === '') throw new Error('toConcentration: form not chosen');
  const note = c.note?.trim();
  const base: Concentration = { id: c.id, value: c.value, form: c.form, routes: normalizeRoutes(c.routes ?? []) };
  return note ? { ...base, note } : base;
}
