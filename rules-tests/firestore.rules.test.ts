// Runs against the Firestore emulator only (npm run test:rules) - the same cases as the
// Rules Playground checks in the specs, automated. Uses a demo- project id, so it can never
// touch the real project.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-wildrx',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const admin = () => env.authenticatedContext('admin').firestore();
const visitor = () => env.unauthenticatedContext().firestore();

const med = (over: Record<string, unknown> = {}) => ({
  name: 'Meloxicam', doseUnit: 'mg', schemaVersion: 2,
  concentrations: [{ id: 'o', value: 1.5, form: 'oral', routes: ['PO'] }],
  ...over,
});

const rule = (over: Record<string, unknown> = {}) => ({
  medicationId: 'meloxicam', target: { type: 'species', value: 'rth' }, route: 'PO',
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: 'admin',
  ...over,
});
const ruleId = 'meloxicam__species-rth__PO';

describe('medications', () => {
  it('allows an admin write with schemaVersion 2', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'medications/meloxicam'), med()));
  });

  it('denies a write without schemaVersion (old admin builds strip bottle routes)', async () => {
    const old: Record<string, unknown> = med();
    delete old.schemaVersion;
    await assertFails(setDoc(doc(admin(), 'medications/meloxicam'), old));
  });

  it.each([1, '2'])('denies schemaVersion %j', async v => {
    await assertFails(setDoc(doc(admin(), 'medications/meloxicam'), med({ schemaVersion: v })));
  });

  it('denies an unknown dose unit', async () => {
    await assertFails(setDoc(doc(admin(), 'medications/meloxicam'), med({ doseUnit: 'mcg' })));
  });

  it('denies a signed-out write but allows a signed-out read', async () => {
    await assertFails(setDoc(doc(visitor(), 'medications/meloxicam'), med()));
    await assertSucceeds(getDoc(doc(visitor(), 'medications/meloxicam')));
  });
});

describe('dosingRules', () => {
  it('allows a rule whose id matches med, target and route', async () => {
    await assertSucceeds(setDoc(doc(admin(), `dosingRules/${ruleId}`), rule()));
  });

  it.each([
    ['old-format id (no route)', 'meloxicam__species-rth'],
    ['random UUID id', '3f2b9c1e-8d4a-4e6b-9a7c-1b2d3e4f5a6b'],
    ['id whose route does not match the rule', 'meloxicam__species-rth__IM'],
  ])('denies an %s', async (_label, id) => {
    await assertFails(setDoc(doc(admin(), `dosingRules/${id}`), rule()));
  });

  it('denies the UI-only source field', async () => {
    await assertFails(setDoc(doc(admin(), `dosingRules/${ruleId}`), rule({ source: 'group' })));
  });

  it('denies old-shape mg fields', async () => {
    await assertFails(setDoc(doc(admin(), `dosingRules/${ruleId}`), rule({ mgPerKg: { min: 1, typical: 1, max: 1 } })));
  });

  it('denies a signed-out write', async () => {
    await assertFails(setDoc(doc(visitor(), `dosingRules/${ruleId}`), rule()));
  });
});
