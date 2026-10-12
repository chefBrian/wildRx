// Pure planning for scripts/migrate-concentration-routes.mjs. No Firestore here so it can be
// unit tested (migrateConcentrationRoutes.test.mjs).
import { DEFAULT_ROUTES } from './defaultRoutes.mjs';

const FORMS = Object.keys(DEFAULT_ROUTES);

/**
 * One medication doc → what to write. Bottles without `routes` get a copy of their form's
 * defaults (never IV); every doc gets schemaVersion 2. `bottles` lists every bottle for the
 * report; `flags` need a human but don't block; a `problem` blocks --write.
 */
export function planMedication(id, data) {
  if (!Array.isArray(data.concentrations)) {
    return { status: 'problem', problem: `${id}: concentrations is not a list`, bottles: [], flags: [] };
  }
  const bottles = [];
  const flags = [];
  const concentrations = [];
  let filled = false;
  for (const c of data.concentrations) {
    if (!FORMS.includes(c.form)) {
      return { status: 'problem', problem: `${id}: concentration ${c.id} has unknown form ${c.form}`, bottles: [], flags: [] };
    }
    const explicit = Array.isArray(c.routes);
    const routes = explicit ? c.routes : [...DEFAULT_ROUTES[c.form]];
    if (!explicit) filled = true;
    const label = `${id} (${data.name}): ${c.value} ${data.doseUnit}/ml ${c.form}${c.note ? ` (${c.note})` : ''}`;
    bottles.push(`${label} -> ${routes.length ? routes.join(', ') : 'none'}${explicit ? '' : ' [default]'}`);
    if (routes.length === 0) flags.push(`${label} has no routes - an admin must tick them before it can be used`);
    concentrations.push(explicit ? c : { ...c, routes });
  }
  const versioned = typeof data.schemaVersion === 'number' && data.schemaVersion >= 2;
  if (!filled && versioned) return { status: 'skip', bottles, flags };
  return { status: 'change', data: { ...data, concentrations, schemaVersion: 2 }, bottles, flags };
}

/** null when --write may proceed; otherwise the refusal message. */
export function writeGate(problems) {
  if (problems.length === 0) return null;
  return `Refusing --write: ${problems.length} problem(s). Fix them by hand and re-run the dry run until it is clean.`;
}
