// scripts/migrate-dose-units.mjs
//
// One-time migration to the dose-units schema
// (docs/superpowers/specs/2026-10-11-dose-units-design.md).
//
// AUTH: Admin SDK with Application Default Credentials, same as seed.mjs.
//     gcloud auth application-default login
//
// USAGE:
//     node scripts/migrate-dose-units.mjs           # dry run - prints report, writes nothing
//     node scripts/migrate-dose-units.mjs --write   # applies changes
//
// CUTOVER ORDER: build -> deploy firestore rules -> --write -> deploy hosting.
// See the plan's Cutover section.

import { randomUUID } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrateMedication, migrateRule, ruleFlags } from './lib/migrateDoseUnits.mjs';

const PROJECT_ID = 'wildrx';
const WRITE = process.argv.includes('--write');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

async function main() {
  console.log(`${WRITE ? 'WRITING' : 'DRY RUN'} - project=${PROJECT_ID}\n`);
  const review = [];
  const formsByMed = new Map();   // medId -> forms[] (null for ml meds)
  let medsChanged = 0;
  let rulesChanged = 0;
  let skipped = 0;

  const meds = await db.collection('medications').get();
  for (const doc of meds.docs) {
    const r = migrateMedication(doc.data(), () => randomUUID().slice(0, 8));
    const current = r ? r.data : doc.data();
    formsByMed.set(doc.id, current.doseUnit === 'ml' ? null : current.concentrations.map(c => c.form));
    if (!r) { skipped++; continue; }
    medsChanged++;
    console.log(`med ${doc.id} (${r.data.name}): ${r.data.concentrations.length} concentration(s)`);
    for (const f of r.flags) review.push(`med ${doc.id} (${r.data.name}): ${f}`);
    if (WRITE) await doc.ref.set(r.data);
  }

  const rules = await db.collection('dosingRules').get();
  for (const doc of rules.docs) {
    const r = migrateRule(doc.data());
    const current = r ?? doc.data();
    for (const f of ruleFlags(current, formsByMed.get(current.medicationId))) {
      review.push(`rule ${doc.id}: ${f}`);
    }
    if (!formsByMed.has(current.medicationId)) review.push(`rule ${doc.id}: medication ${current.medicationId} not found`);
    if (!r) { skipped++; continue; }
    rulesChanged++;
    console.log(`rule ${doc.id}`);
    if (WRITE) await doc.ref.set(r);
  }

  console.log(`\n${medsChanged} meds, ${rulesChanged} rules ${WRITE ? 'migrated' : 'would migrate'}; ${skipped} already migrated.`);
  console.log(`\nREVIEW (${review.length}):`);
  for (const line of review) console.log(`  - ${line}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err.message ?? err);
  if (/could not load the default credentials/i.test(String(err))) {
    console.error('\nRun once:\n    gcloud auth application-default login');
  }
  process.exit(1);
});
