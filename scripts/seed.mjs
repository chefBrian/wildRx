// scripts/seed.mjs
//
// Seeds Firestore with starter species, medications, and dosing rules for
// Georgia wildlife rehabilitation. Idempotent — re-running overwrites existing
// docs by stable slug IDs.
//
// AUTH: uses the Firebase Admin SDK with Application Default Credentials (ADC).
// The Admin SDK bypasses Firestore security rules. Run from a machine where
// you've already run:
//     gcloud auth application-default login
// (one-time setup; opens a browser).
//
// USAGE:
//     node scripts/seed.mjs
//
// IMPORTANT: The dosing values below are reasonable starter ranges drawn from
// common wildlife rehabilitation references. THEY ARE STARTER DATA. Verify
// against your hospital's current protocols and have your supervising vet
// review before clinical use. Every rule's `notes` field flags this.

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'wildrx';

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore();

const now = Date.now();
const SEED_BY = 'seed-script';
const STARTER_NOTE = 'Starter data — verify against current protocols before clinical use.';

// ---------- SPECIES ----------
const species = [
  {
    id: 'red-tailed-hawk',
    commonName: 'Red-tailed Hawk',
    scientificName: 'Buteo jamaicensis',
    group: 'raptor',
    typicalWeightGrams: { min: 700, max: 1500 },
    notes: 'Most common large hawk seen in Georgia.',
  },
  {
    id: 'red-shouldered-hawk',
    commonName: 'Red-shouldered Hawk',
    scientificName: 'Buteo lineatus',
    group: 'raptor',
    typicalWeightGrams: { min: 480, max: 700 },
  },
  {
    id: 'barred-owl',
    commonName: 'Barred Owl',
    scientificName: 'Strix varia',
    group: 'raptor',
    typicalWeightGrams: { min: 470, max: 1050 },
  },
  {
    id: 'eastern-screech-owl',
    commonName: 'Eastern Screech-Owl',
    scientificName: 'Megascops asio',
    group: 'raptor',
    typicalWeightGrams: { min: 130, max: 250 },
  },
  {
    id: 'great-horned-owl',
    commonName: 'Great Horned Owl',
    scientificName: 'Bubo virginianus',
    group: 'raptor',
    typicalWeightGrams: { min: 900, max: 1800 },
  },
  {
    id: 'american-robin',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    group: 'songbird',
    typicalWeightGrams: { min: 65, max: 100 },
  },
  {
    id: 'northern-cardinal',
    commonName: 'Northern Cardinal',
    scientificName: 'Cardinalis cardinalis',
    group: 'songbird',
    typicalWeightGrams: { min: 33, max: 65 },
  },
  {
    id: 'carolina-wren',
    commonName: 'Carolina Wren',
    scientificName: 'Thryothorus ludovicianus',
    group: 'songbird',
    typicalWeightGrams: { min: 18, max: 23 },
  },
  {
    id: 'mallard',
    commonName: 'Mallard',
    scientificName: 'Anas platyrhynchos',
    group: 'waterfowl',
    typicalWeightGrams: { min: 700, max: 1600 },
  },
  {
    id: 'wood-duck',
    commonName: 'Wood Duck',
    scientificName: 'Aix sponsa',
    group: 'waterfowl',
    typicalWeightGrams: { min: 450, max: 870 },
  },
  {
    id: 'canada-goose',
    commonName: 'Canada Goose',
    scientificName: 'Branta canadensis',
    group: 'waterfowl',
    typicalWeightGrams: { min: 3000, max: 5500 },
  },
  {
    id: 'great-blue-heron',
    commonName: 'Great Blue Heron',
    scientificName: 'Ardea herodias',
    group: 'wadingBird',
    typicalWeightGrams: { min: 2100, max: 2500 },
  },
  {
    id: 'eastern-gray-squirrel',
    commonName: 'Eastern Gray Squirrel',
    scientificName: 'Sciurus carolinensis',
    group: 'smallMammal',
    typicalWeightGrams: { min: 400, max: 600 },
  },
  {
    id: 'eastern-cottontail',
    commonName: 'Eastern Cottontail',
    scientificName: 'Sylvilagus floridanus',
    group: 'smallMammal',
    typicalWeightGrams: { min: 800, max: 1500 },
    notes: 'Lagomorph — sensitive to many antibiotics (oral penicillins, clindamycin).',
  },
  {
    id: 'virginia-opossum',
    commonName: 'Virginia Opossum',
    scientificName: 'Didelphis virginiana',
    group: 'mediumMammal',
    typicalWeightGrams: { min: 1800, max: 6000 },
  },
  {
    id: 'raccoon',
    commonName: 'Raccoon',
    scientificName: 'Procyon lotor',
    group: 'mediumMammal',
    typicalWeightGrams: { min: 4000, max: 9000 },
    notes: 'Rabies vector species — handle with PPE.',
  },
  {
    id: 'big-brown-bat',
    commonName: 'Big Brown Bat',
    scientificName: 'Eptesicus fuscus',
    group: 'smallMammal',
    typicalWeightGrams: { min: 14, max: 25 },
    notes: 'Rabies vector species — handle with PPE.',
  },
  {
    id: 'eastern-box-turtle',
    commonName: 'Eastern Box Turtle',
    scientificName: 'Terrapene carolina',
    group: 'reptile',
    typicalWeightGrams: { min: 350, max: 500 },
  },
  {
    id: 'eastern-garter-snake',
    commonName: 'Eastern Garter Snake',
    scientificName: 'Thamnophis sirtalis',
    group: 'reptile',
    typicalWeightGrams: { min: 100, max: 250 },
  },
];

// ---------- MEDICATIONS ----------
const medications = [
  {
    id: 'meloxicam',
    name: 'Meloxicam',
    genericName: 'Meloxicam',
    concentrations: [
      { label: '1.5 mg/ml oral suspension (Metacam)', mgPerMl: 1.5 },
      { label: '5 mg/ml injectable', mgPerMl: 5 },
    ],
    defaultRoute: 'PO',
    notes: 'NSAID. Risk of nephrotoxicity in dehydrated/hypovolemic patients.',
  },
  {
    id: 'carprofen',
    name: 'Carprofen',
    genericName: 'Carprofen',
    concentrations: [
      { label: '50 mg/ml injectable (Rimadyl)', mgPerMl: 50 },
      { label: '25 mg/ml suspension', mgPerMl: 25 },
    ],
    defaultRoute: 'SC',
    notes: 'NSAID. Same nephrotoxicity caution as meloxicam.',
  },
  {
    id: 'buprenorphine',
    name: 'Buprenorphine',
    genericName: 'Buprenorphine',
    concentrations: [
      { label: '0.3 mg/ml injectable', mgPerMl: 0.3 },
    ],
    defaultRoute: 'IM',
    notes: 'Opioid partial agonist. Controlled substance.',
  },
  {
    id: 'enrofloxacin',
    name: 'Enrofloxacin',
    genericName: 'Enrofloxacin',
    concentrations: [
      { label: '22.7 mg/ml oral suspension (Baytril)', mgPerMl: 22.7 },
      { label: '100 mg/ml injectable', mgPerMl: 100 },
    ],
    defaultRoute: 'PO',
    notes: 'Fluoroquinolone antibiotic. Cartilage damage in juveniles — use cautiously in growing animals.',
  },
  {
    id: 'amoxicillin-clavulanate',
    name: 'Amoxicillin-Clavulanate',
    genericName: 'Amoxicillin + Clavulanic Acid',
    concentrations: [
      { label: '62.5 mg/ml drops (Clavamox)', mgPerMl: 62.5 },
    ],
    defaultRoute: 'PO',
    notes: 'Beta-lactam antibiotic. FATAL in rabbits and many hindgut fermenters — never use in lagomorphs.',
  },
  {
    id: 'itraconazole',
    name: 'Itraconazole',
    genericName: 'Itraconazole',
    concentrations: [
      { label: '10 mg/ml oral suspension (Sporanox)', mgPerMl: 10 },
    ],
    defaultRoute: 'PO',
    notes: 'Triazole antifungal. First-line for raptor aspergillosis. Hepatotoxic with long courses.',
  },
  {
    id: 'metronidazole',
    name: 'Metronidazole',
    genericName: 'Metronidazole',
    concentrations: [
      { label: '50 mg/ml suspension', mgPerMl: 50 },
    ],
    defaultRoute: 'PO',
    notes: 'Antiprotozoal + anti-anaerobic. Bitter taste; oral compliance can be poor.',
  },
  {
    id: 'fenbendazole',
    name: 'Fenbendazole',
    genericName: 'Fenbendazole',
    concentrations: [
      { label: '100 mg/ml suspension (Panacur)', mgPerMl: 100 },
    ],
    defaultRoute: 'PO',
    notes: 'Broad-spectrum anthelmintic. Multi-day course standard.',
  },
];

// ---------- DOSING RULES ----------
const rule = (medId, target, body) => ({
  id: `${medId}__${target.type}-${target.value}`,
  medicationId: medId,
  target,
  ...body,
  contraindications: body.contraindications ?? [],
  durationDays: body.durationDays ?? null,
  maxSingleDoseMg: body.maxSingleDoseMg ?? null,
  notes: `${STARTER_NOTE}${body.notes ? ' ' + body.notes : ''}`,
  updatedAt: now,
  updatedBy: SEED_BY,
});

const dosingRules = [
  // Meloxicam
  rule('meloxicam', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise', 'GI ulceration'],
    notes: 'Ensure hydration before NSAIDs in raptors.',
  }),
  rule('meloxicam', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 0.2, max: 0.5, typical: 0.2 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('meloxicam', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise', 'GI ulceration'],
  }),
  rule('meloxicam', { type: 'species', value: 'red-tailed-hawk' }, {
    mgPerKg: { min: 0.2, max: 0.5, typical: 0.3 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'RTHs often dosed at the low end of raptor range; some references suggest 0.5 mg/kg.',
  }),

  // Carprofen
  rule('carprofen', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 1, max: 3, typical: 1 },
    route: 'IM',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('carprofen', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 2, max: 4, typical: 2 },
    route: 'SC',
    frequency: 'q12h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),

  // Buprenorphine
  rule('buprenorphine', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 0.05, max: 0.5, typical: 0.1 },
    route: 'IM',
    frequency: 'q6-12h',
    contraindications: ['Respiratory depression', 'Head trauma (sedation may confound exam)'],
    notes: 'Wide species variation in raptor opioid response — owls more responsive than diurnal raptors.',
  }),
  rule('buprenorphine', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 0.01, max: 0.05, typical: 0.03 },
    route: 'SC',
    frequency: 'q8-12h',
    contraindications: ['Respiratory depression'],
    notes: 'Rabbits clear opioids quickly; redose accordingly.',
  }),

  // Enrofloxacin
  rule('enrofloxacin', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juvenile/growing birds (cartilage)', 'Concurrent NSAID + dehydration'],
  }),
  rule('enrofloxacin', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 10 },
    contraindications: ['Juvenile/growing birds'],
  }),
  rule('enrofloxacin', { type: 'species', value: 'eastern-box-turtle' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Severe dehydration (lower renal clearance)'],
    notes: 'Reptile dosing is slower — chelonian metabolism reduces frequency to q24h.',
  }),

  // Clavamox
  rule('amoxicillin-clavulanate', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 12.5, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Lagomorphs (rabbits)', 'Hindgut fermenters', 'Guinea pigs', 'Chinchillas'],
    notes: 'DO NOT USE in rabbits or other hindgut fermenters — fatal enteric dysbiosis. Squirrels and opossums tolerate; verify species before dosing.',
  }),

  // Itraconazole
  rule('itraconazole', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 14, max: 90 },
    contraindications: ['Hepatic disease', 'Concurrent hepatotoxins'],
    notes: 'Long-course therapy for confirmed/suspected aspergillosis. Monitor for hepatotoxicity.',
  }),

  // Metronidazole
  rule('metronidazole', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 25, max: 50, typical: 30 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
    notes: 'For trichomoniasis (frounce). Higher end of range may be needed for severe infections.',
  }),
  rule('metronidazole', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 10, max: 25, typical: 20 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
  }),

  // Fenbendazole
  rule('fenbendazole', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    contraindications: ['Concurrent severe debility (bone marrow suppression in some species)'],
    notes: 'Avoid in vultures (severe toxicity reported).',
  }),
  rule('fenbendazole', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
  }),
  rule('fenbendazole', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 50, max: 100, typical: 50 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Reptiles often need higher dose; repeat course in 2 weeks for nematodes.',
  }),

  // ---- WATERFOWL group coverage ----
  rule('meloxicam', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Hydrate well before NSAID dosing.',
  }),
  rule('carprofen', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 1, max: 4, typical: 2 },
    route: 'IM',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('enrofloxacin', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juvenile/growing birds (cartilage)'],
  }),
  rule('metronidazole', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 20, max: 50, typical: 30 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
  }),
  rule('itraconazole', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 14, max: 60 },
    contraindications: ['Hepatic disease'],
    notes: 'Aspergillosis treatment course in ducks/geese; monitor LFTs on long courses.',
  }),
  rule('fenbendazole', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
  }),

  // ---- WADING-BIRD group coverage ----
  rule('meloxicam', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('carprofen', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 1, max: 3, typical: 2 },
    route: 'IM',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('enrofloxacin', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juvenile/growing birds'],
  }),
  rule('itraconazole', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 14, max: 60 },
    contraindications: ['Hepatic disease'],
  }),
  rule('fenbendazole', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
  }),

  // ---- MEDIUM-MAMMAL group coverage (opossums, raccoons) ----
  rule('meloxicam', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 0.1, max: 0.3, typical: 0.2 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise', 'GI ulceration'],
    notes: 'Lower mg/kg than small mammals — allometric scaling.',
  }),
  rule('carprofen', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 2, max: 4, typical: 2 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('buprenorphine', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 0.01, max: 0.03, typical: 0.02 },
    route: 'SC',
    frequency: 'q8-12h',
    contraindications: ['Respiratory depression'],
  }),
  rule('enrofloxacin', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 5, max: 15, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juveniles (cartilage)', 'Severe dehydration'],
    notes: 'Use the low end in raccoons; some references cite hypersensitivity reactions.',
  }),
  rule('amoxicillin-clavulanate', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 12.5, max: 22, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Concurrent severe diarrhea'],
    notes: 'Opossums and raccoons tolerate beta-lactams well; carnivore-dosing schedules apply.',
  }),
  rule('metronidazole', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 10, max: 25, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
  }),
  rule('fenbendazole', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 20, max: 50, typical: 50 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
  }),

  // ---- SONGBIRD additions ----
  rule('carprofen', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 1, max: 4, typical: 2 },
    route: 'IM',
    frequency: 'q12h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
  }),
  rule('itraconazole', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 5, max: 10, typical: 5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 14, max: 30 },
    contraindications: ['Hepatic disease'],
    notes: 'Aspergillosis prophylaxis or treatment in passerines.',
  }),
  rule('metronidazole', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
  }),
  rule('fenbendazole', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
  }),

  // ---- REPTILE additions ----
  rule('meloxicam', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 },
    route: 'PO',
    frequency: 'q24-48h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Lower frequency than mammals/birds — slower reptile metabolism.',
  }),
  rule('enrofloxacin', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q24-48h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Severe dehydration'],
    notes: 'Most reptiles tolerate q48h; small lizards may need q24h.',
  }),
  rule('metronidazole', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24-48h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease', 'Snakes (some species sensitive — start low)'],
  }),
  rule('buprenorphine', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 0.02, max: 0.2, typical: 0.05 },
    route: 'IM',
    frequency: 'q24-48h',
    contraindications: ['Respiratory depression'],
    notes: 'Reptile opioid response is highly variable by species; consider mu-agonists as alternative.',
  }),
];

// ---------- WRITE ----------
async function writeAll(collName, items) {
  let count = 0;
  for (const it of items) {
    const { id, ...rest } = it;
    await db.collection(collName).doc(id).set(rest);
    count++;
  }
  console.log(`  wrote ${count} ${collName}`);
}

async function main() {
  console.log(`Seeding project=${PROJECT_ID} via Admin SDK ...`);
  await writeAll('species', species);
  await writeAll('medications', medications);
  await writeAll('dosingRules', dosingRules);
  console.log('Done.');
  process.exit(0);
}

main().catch(err => {
  console.error('Seed failed:', err.message ?? err);
  if (err.code === 'ENOENT' || /could not load the default credentials/i.test(String(err))) {
    console.error('');
    console.error('Application Default Credentials not found. Run once:');
    console.error('    gcloud auth application-default login');
  }
  process.exit(1);
});
