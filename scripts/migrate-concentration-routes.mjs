// scripts/migrate-concentration-routes.mjs
//
// Gives every bottle an explicit `routes` list (form defaults, never IV) and every medication
// schemaVersion 2 (docs/superpowers/specs/2026-10-12-route-limits-and-fact-sheet-design.md).
//
// AUTH: Admin SDK with Application Default Credentials, same as seed.mjs.
//     gcloud auth application-default login
//
// USAGE:
//     node scripts/migrate-concentration-routes.mjs           # dry run - lists every bottle, writes nothing
//     node scripts/migrate-concentration-routes.mjs --write   # refuses unless clean; backs up, then writes
//
// Review the dry-run bottle list (ideally with the client's vet) before --write.
// Backups go to backups/concentration-routes-<timestamp>.json; with --write the report is
// saved next to it as .report.txt.
//
// CUTOVER ORDER (each step only with the user's go-ahead):
//     npm run build
//     node scripts/migrate-concentration-routes.mjs
//     node scripts/migrate-concentration-routes.mjs --write
//     (Rules Playground: medication write with schemaVersion 2 allowed, without it denied)
//     firebase deploy --only firestore:rules
//     firebase deploy --only hosting

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { planMedication, writeGate } from './lib/migrateConcentrationRoutes.mjs';

const PROJECT_ID = 'wildrx';
const WRITE = process.argv.includes('--write');
const BACKUP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'backups');

initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore();

const out = [];
function log(line = '') {
  out.push(line);
  console.log(line);
}

async function main() {
  log(`${WRITE ? 'WRITING' : 'DRY RUN'} - project=${PROJECT_ID}\n`);
  const medDocs = (await db.collection('medications').get()).docs;
  const plans = medDocs.map(d => ({ doc: d, plan: planMedication(d.id, d.data()) }));
  const problems = plans.filter(p => p.plan.status === 'problem').map(p => p.plan.problem);
  const changes = plans.filter(p => p.plan.status === 'change');

  log('BOTTLES:');
  for (const { plan } of plans) for (const b of plan.bottles) log(`  ${b}`);
  log(`\n${changes.length} medication(s) to update, ${plans.length - changes.length - problems.length} already done, ${problems.length} problem(s).`);
  log(`\nPROBLEMS (${problems.length}) - block --write:`);
  for (const p of problems) log(`  - ${p}`);
  const flags = plans.flatMap(p => p.plan.flags);
  log(`\nFLAGS (${flags.length}) - review; not blocking:`);
  for (const f of flags) log(`  - ${f}`);

  if (!WRITE) process.exit(0);
  const refusal = writeGate(problems);
  if (refusal) {
    console.error(`\n${refusal}`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/:/g, '-');
  await writeBackup(medDocs, stamp);
  for (const { doc, plan } of changes) {
    // Precondition: fails if the doc changed since it was read.
    await doc.ref.update(
      { concentrations: plan.data.concentrations, schemaVersion: 2 },
      { lastUpdateTime: doc.updateTime },
    );
    log(`wrote ${doc.id}`);
  }
  const reportPath = join(BACKUP_DIR, `concentration-routes-${stamp}.report.txt`);
  await writeFile(reportPath, out.join('\n') + '\n');
  console.log(`\nReport saved: ${reportPath}`);
  process.exit(0);
}

// Snapshot of medications before the first write, so a bad run can be restored by hand.
async function writeBackup(medDocs, stamp) {
  const path = join(BACKUP_DIR, `concentration-routes-${stamp}.json`);
  await mkdir(BACKUP_DIR, { recursive: true });
  await writeFile(path, JSON.stringify({ medications: medDocs.map(d => ({ id: d.id, data: d.data() })) }, null, 2));
  console.log(`Backup written: ${path}\n`);
}

main().catch(err => {
  console.error('Migration failed:', err.message ?? err);
  if (/could not load the default credentials/i.test(String(err))) {
    console.error('\nRun once:\n    gcloud auth application-default login');
  }
  process.exit(1);
});
