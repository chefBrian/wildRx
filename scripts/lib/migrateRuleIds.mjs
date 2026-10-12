// Pure planning for scripts/migrate-rule-ids.mjs. No Firestore here so it can be
// unit tested (scripts/lib/migrateRuleIds.test.mjs).
import { ruleId } from './ruleId.mjs';

const ROUTES = ['PO', 'IM', 'SC', 'IV', 'topical'];
const TARGET_TYPES = ['group', 'species'];

/**
 * docs: [{ id, data }] for every dosingRules doc.
 * Returns the re-keys to apply plus anything that needs a human. A plan with
 * problems must not be written (see writeGate).
 */
export function planRuleRekeys(docs) {
  const ids = new Set(docs.map(d => d.id));
  const problems = [];
  const alreadyCorrect = [];
  const candidates = [];
  for (const { id, data } of docs) {
    const newId = computeId(data);
    if (newId === null) {
      problems.push(`${id}: missing or invalid medicationId, target or route - fix by hand`);
    } else if (newId === id) {
      alreadyCorrect.push(id);
    } else {
      candidates.push({ oldId: id, newId });
    }
  }
  const byNewId = new Map();
  for (const c of candidates) byNewId.set(c.newId, [...(byNewId.get(c.newId) ?? []), c.oldId]);
  const rekeys = [];
  const reported = new Set();
  for (const c of candidates) {
    const sharing = byNewId.get(c.newId);
    if (ids.has(c.newId)) {
      problems.push(`${c.oldId}: new id ${c.newId} is already taken by an existing doc`);
    } else if (sharing.length > 1) {
      if (!reported.has(c.newId)) problems.push(`${sharing.join(', ')}: all map to ${c.newId}`);
      reported.add(c.newId);
    } else {
      rekeys.push(c);
    }
  }
  return { rekeys, alreadyCorrect, problems };
}

/**
 * Rules pointing at a species or medication that no longer exists. Review-only, not a
 * gate: species deletes weren't blocked before, and a species recreated under the same
 * slug would silently pick these up.
 */
export function findOrphans(docs, { speciesIds, medIds }) {
  const out = [];
  for (const { id, data } of docs) {
    const t = data.target;
    if (t?.type === 'species' && t.value && !speciesIds.has(t.value)) out.push(`${id}: species ${t.value} not found`);
    if (data.medicationId && !medIds.has(data.medicationId)) out.push(`${id}: medication ${data.medicationId} not found`);
  }
  return out;
}

/** null when --write may proceed; otherwise the refusal message. */
export function writeGate(plan) {
  if (plan.problems.length === 0) return null;
  return `Refusing --write: ${plan.problems.length} problem(s). Fix them by hand and re-run the dry run until it is clean.`;
}

function computeId(data) {
  const t = data.target;
  if (!data.medicationId || !t || !TARGET_TYPES.includes(t.type) || !t.value || !ROUTES.includes(data.route)) {
    return null;
  }
  return ruleId(data.medicationId, t, data.route);
}
