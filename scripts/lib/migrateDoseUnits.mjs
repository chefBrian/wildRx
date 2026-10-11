// Pure transforms for scripts/migrate-dose-units.mjs. No Firestore here so
// they can be unit tested (scripts/lib/migrateDoseUnits.test.mjs).

// Keep in sync with STRENGTH_IN_TEXT in src/domain/validate.ts (a test pins this).
export const NOTE_STRENGTH = /\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|units?|%)(?![a-z])/i;

// Names/labels that suggest IU or ml dosing squeezed into mg. Report-only, so
// false positives are cheap and false negatives are not.
export const UNIT_HINT = new RegExp([
  String.raw`\bIU\b`, String.raw`\bunits?\b`,
  String.raw`\bvit(amin)?\.?\s*[ADE]\d?\b`,
  String.raw`\b(e|bo)-?se\b`, 'selenium',
  'penicillin', 'insulin', 'heparin', 'oxytocin',
  String.raw`\bLRS\b`, 'lactated', 'ringer', 'saline', 'normosol', String.raw`plasma-?lyte`,
  'dextrose', String.raw`\bnacl\b`, String.raw`0\.9\s*%`,
  'pepto', 'pedialyte', 'lactulose',
].join('|'), 'i');

const LEADING_STRENGTH = /^\s*[\d.,]+\s*(mg|iu)(\/ml)?\s*/i;
const FORM_WORDS = /\b(injectable|injection|oral|suspension|solution)\b/gi;
const INJECTION_ROUTES = ['IM', 'SC', 'IV'];

export function migrateMedication(data, makeId) {
  if ('doseUnit' in data) return null;
  const flags = [];
  const concentrations = [];
  const lines = [];
  for (const c of data.concentrations ?? []) {
    const label = String(c.label ?? '');
    if (/tablet/i.test(label)) {
      flags.push(`removed tablet: "${label}"`);
      continue;
    }
    const value = Number(c.mgPerMl ?? 0);
    if (!(value > 0)) {
      flags.push(`dropped zero strength: "${label}"`);
      continue;
    }
    const form = parseForm(label);
    const note = noteFromLabel(label);
    const labelStrength = leadingStrength(label);
    if (labelStrength !== null && labelStrength !== value) {
      flags.push(`label strength ${labelStrength} disagrees with number ${value} - confirm the bottle: "${label}"`);
    }
    if (form === 'other') flags.push(`form parsed as other: "${label}"`);
    if (note && NOTE_STRENGTH.test(note)) flags.push(`note contains a strength - edit before saving: "${note}"`);
    concentrations.push(note ? { id: makeId(), value, form, note } : { id: makeId(), value, form });
    lines.push(`"${label}" (mgPerMl ${c.mgPerMl}) → ${[`${value} mg/ml`, form, note].filter(Boolean).join(' · ')}`);
  }
  if (looksLikeNonMg(data)) flags.push('name/labels/notes suggest IU or ml dosing - check unit');
  const { concentrations: _old, ...rest } = data;
  return { data: { ...rest, doseUnit: 'mg', concentrations }, flags, lines };
}

function leadingStrength(label) {
  const m = /^\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:mg|iu)/i.exec(label);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseForm(label) {
  const l = label.toLowerCase();
  // "inject" first so "injectable suspension" stays injectable.
  if (l.includes('inject')) return 'injectable';
  // Eye/ear products are not oral or topical in the app's form model.
  if (/\b(ophthalmic|otic|eye|ear)\b/.test(l)) return 'other';
  if (/\b(oral|suspension|solution)\b/.test(l)) return 'oral';
  if (/\b(topical|ointment|cream)\b/.test(l)) return 'topical';
  // Includes "drops": could be eye or ear, so an admin must decide.
  return 'other';
}

export function noteFromLabel(label) {
  // Drop the strength (now in `value`) and form words (now in `form`) so the
  // generated text doesn't read "100 mg/ml · injectable · injectable".
  const rest = label
    .replace(LEADING_STRENGTH, '')
    .replace(FORM_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const unwrapped = rest.replace(/^\((.*)\)$/, '$1').trim();
  return unwrapped === '' ? undefined : unwrapped;
}

function looksLikeNonMg(data) {
  const text = [
    data.name, data.genericName, data.notes,
    ...(data.concentrations ?? []).map(c => c.label),
  ].filter(Boolean).join(' ');
  return UNIT_HINT.test(text);
}

export function migrateRule(data) {
  if ('dosePerKg' in data) return null;
  const { mgPerKg, maxSingleDoseMg, ...rest } = data;
  return { ...rest, dosePerKg: mgPerKg, maxSingleDose: maxSingleDoseMg ?? null };
}

// medForms: the med's concentration forms; null for ml meds; undefined if the med wasn't found.
export function ruleFlags(rule, medForms) {
  const flags = [];
  const { min, typical, max } = rule.dosePerKg ?? {};
  if (!(typical > 0)) flags.push('typical dose <= 0');
  if (!(min > 0 && min <= typical)) flags.push('min is 0 or above typical');
  if (!(max >= typical)) flags.push('max below typical');
  const cap = rule.maxSingleDose;
  if (cap !== null && cap !== undefined && !(cap > 0)) flags.push('max single dose <= 0');
  if (INJECTION_ROUTES.includes(rule.route) && Array.isArray(medForms) && !medForms.includes('injectable')) {
    flags.push(`${rule.route} rule but the med has no injectable concentration`);
  }
  return flags;
}
