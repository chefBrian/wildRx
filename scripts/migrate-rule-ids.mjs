// scripts/migrate-rule-ids.mjs
//
// Re-keys dosingRules docs to `${medId}__${type}-${value}__${route}`
// (docs/superpowers/specs/2026-10-11-animal-first-design.md).
//
// AUTH: Admin SDK with Application Default Credentials, same as seed.mjs.
//     gcloud auth application-default login
//
// USAGE:
//     node scripts/migrate-rule-ids.mjs           # dry run - prints the plan, writes nothing
//     node scripts/migrate-rule-ids.mjs --write   # refuses unless the plan is clean; backs up, then re-keys
//
// Backups go to backups/rule-ids-<timestamp>.json (gitignored). A failed backup
// aborts before any Firestore write. With --write the report is also saved as
// backups/rule-ids-<timestamp>.report.txt.
//
// CUTOVER ORDER (each step only with the user's go-ahead):
//     npm run build
//     node scripts/migrate-rule-ids.mjs            # must be clean
//     node scripts/migrate-rule-ids.mjs --write
//     (Rules Playground checks, see the spec)
//     firebase deploy --only firestore:rules
//     firebase deploy --only hosting
// Don't run scripts/seed.mjs against prod until this has run: the new seed ids
// would sit next to the old ones and both would resolve.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { findOrphans, planRuleRekeys, writeGate } from './lib/migrateRuleIds.mjs';

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
  const ruleDocs = (await db.collection('dosingRules').get()).docs;
  const speciesIds = new Set((await db.collection('species').get()).docs.map(d => d.id));
  const medIds = new Set((await db.collection('medications').get()).docs.map(d => d.id));
  const docs = ruleDocs.map(d => ({ id: d.id, data: d.data() }));
  const plan = planRuleRekeys(docs);
  const orphans = findOrphans(docs, { speciesIds, medIds });

  for (const { oldId, newId } of plan.rekeys) log(`re-key ${oldId} -> ${newId}`);
  log(`\n${plan.rekeys.length} to re-key, ${plan.alreadyCorrect.length} already correct, ${plan.problems.length} problem(s), ${orphans.length} orphan(s).`);
  log(`\nPROBLEMS (${plan.problems.length}) - block --write:`);
  for (const p of plan.problems) log(`  - ${p}`);
  log(`\nORPHANS (${orphans.length}) - review and delete by hand; not blocking:`);
  for (const o of orphans) log(`  - ${o}`);

  if (!WRITE) process.exit(0);
  const refusal = writeGate(plan);
  if (refusal) {
    console.error(`\n${refusal}`);
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/:/g, '-');
  await writeBackup(ruleDocs, stamp);
  const byId = new Map(ruleDocs.map(d => [d.id, d]));
  for (const { oldId, newId } of plan.rekeys) {
    // create() fails if newId appeared since the plan was made; the batch is atomic.
    const batch = db.batch();
    batch.create(db.collection('dosingRules').doc(newId), byId.get(oldId).data());
    batch.delete(byId.get(oldId).ref);
    await batch.commit();
    log(`wrote ${newId} (deleted ${oldId})`);
  }
  const reportPath = join(BACKUP_DIR, `rule-ids-${stamp}.report.txt`);
  await writeFile(reportPath, out.join('\n') + '\n');
  console.log(`\nReport saved: ${reportPath}`);
  process.exit(0);
}

// Snapshot of dosingRules before the first write, so a bad run can be restored by hand.
async function writeBackup(ruleDocs, stamp) {
  const path = join(BACKUP_DIR, `rule-ids-${stamp}.json`);
  await mkdir(BACKUP_DIR, { recursive: true });
  await writeFile(path, JSON.stringify({ dosingRules: ruleDocs.map(d => ({ id: d.id, data: d.data() })) }, null, 2));
  console.log(`Backup written: ${path}\n`);
}

main().catch(err => {
  console.error('Migration failed:', err.message ?? err);
  if (/could not load the default credentials/i.test(String(err))) {
    console.error('\nRun once:\n    gcloud auth application-default login');
  }
  process.exit(1);
});
