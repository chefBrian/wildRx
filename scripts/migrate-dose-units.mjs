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
//     node scripts/migrate-dose-units.mjs --write   # backs up medications + dosingRules, then applies changes
//
// Backups go to backups/dose-units-<timestamp>.json (gitignored). A failed
// backup aborts before any Firestore write.
//
// With --write the full report is also saved next to the backup as
// backups/dose-units-<timestamp>.report.txt.
//
// CUTOVER ORDER (run exactly in this order):
//     npm run build
//     firebase deploy --only firestore:rules
//     node scripts/migrate-dose-units.mjs --write
//     firebase deploy --only hosting
// See the plan's Cutover section.

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrateMedication, migrateRule, ruleFlags } from './lib/migrateDoseUnits.mjs';

const PROJECT_ID = 'wildrx';
const WRITE = process.argv.includes('--write');
const BACKUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

// Everything printed is also kept here so --write can save it as a report file.
const out = [];
function log(line = '') {
  out.push(line);
  console.log(line);
}

// Label of the doc being processed, so a mid-run failure names the doc.
let processing = null;

async function main() {
  log(`${WRITE ? 'WRITING' : 'DRY RUN'} - project=${PROJECT_ID}\n`);
  const medDocs = (await db.collection('medications').get()).docs;
  const ruleDocs = (await db.collection('dosingRules').get()).docs;
  const stamp = new Date().toISOString().replace(/:/g, '-');
  if (WRITE) await writeBackup(medDocs, ruleDocs, stamp);

  const review = [];
  const formsByMed = new Map();   // medId -> forms[] (null for ml meds)
  let medsChanged = 0;
  let rulesChanged = 0;
  let skipped = 0;

  for (const doc of medDocs) {
    processing = `med ${doc.id}`;
    const r = migrateMedication(doc.data(), () => randomUUID().slice(0, 8));
    const current = r ? r.data : doc.data();
    formsByMed.set(doc.id, current.doseUnit === 'ml' ? null : (current.concentrations ?? []).map(c => c.form));
    if (!r) { skipped++; continue; }
    medsChanged++;
    log(`med ${doc.id} (${r.data.name}): ${r.data.concentrations.length} concentration(s)`);
    for (const l of r.lines) log(`  ${l}`);
    for (const f of r.flags) review.push(`med ${doc.id} (${r.data.name}): ${f}`);
    if (WRITE) {
      await doc.ref.set(r.data);
      log(`wrote med ${doc.id}`);
    }
  }

  for (const doc of ruleDocs) {
    processing = `rule ${doc.id}`;
    const old = doc.data();
    if (!('mgPerKg' in old) && !('dosePerKg' in old)) {
      review.push(`rule ${doc.id}: no dose fields - skipped, fix by hand`);
      continue;
    }
    if ('mgPerKg' in old && 'dosePerKg' in old) {
      review.push(`rule ${doc.id}: has both mgPerKg and dosePerKg - strip mgPerKg/maxSingleDoseMg by hand`);
      continue;
    }
    const r = migrateRule(old);
    const current = r ?? old;
    for (const f of ruleFlags(current, formsByMed.get(current.medicationId))) {
      review.push(`rule ${doc.id}: ${f}`);
    }
    if (!formsByMed.has(current.medicationId)) review.push(`rule ${doc.id}: medication ${current.medicationId} not found`);
    if (!r) { skipped++; continue; }
    rulesChanged++;
    log(`rule ${doc.id}`);
    if (WRITE) {
      await doc.ref.set(r);
      log(`wrote rule ${doc.id}`);
    }
  }

  log(`\n${medsChanged} meds, ${rulesChanged} rules ${WRITE ? 'migrated' : 'would migrate'}; ${skipped} already migrated.`);
  log(`\nREVIEW (${review.length}):`);
  for (const line of review) log(`  - ${line}`);
  if (WRITE) {
    const reportPath = join(BACKUP_DIR, `dose-units-${stamp}.report.txt`);
    await writeFile(reportPath, out.join('\n') + '\n');
    console.log(`\nReport saved: ${reportPath}`);
  }
  process.exit(0);
}

// Snapshot of both collections taken before the first write, so a bad run can be restored by hand.
async function writeBackup(medDocs, ruleDocs, stamp) {
  const path = join(BACKUP_DIR, `dose-units-${stamp}.json`);
  const payload = {
    medications: medDocs.map(d => ({ id: d.id, data: d.data() })),
    dosingRules: ruleDocs.map(d => ({ id: d.id, data: d.data() })),
  };
  await mkdir(BACKUP_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2));
  console.log(`Backup written: ${path}\n`);
}

main().catch(err => {
  console.error(`Migration failed${processing ? ` while processing ${processing}` : ''}:`, err.message ?? err);
  if (/could not load the default credentials/i.test(String(err))) {
    console.error('\nRun once:\n    gcloud auth application-default login');
  }
  process.exit(1);
});
