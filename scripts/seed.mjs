// scripts/seed.mjs
//
// Seeds Firestore with starter species, medications, and dosing rules for
// Georgia wildlife rehabilitation. Idempotent - re-running overwrites existing
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
const STARTER_NOTE = 'Starter data - verify against current protocols before clinical use.';

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
    notes: 'Lagomorph - sensitive to many antibiotics (oral penicillins, clindamycin).',
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
    notes: 'Rabies vector species - handle with PPE.',
  },
  {
    id: 'big-brown-bat',
    commonName: 'Big Brown Bat',
    scientificName: 'Eptesicus fuscus',
    group: 'smallMammal',
    typicalWeightGrams: { min: 14, max: 25 },
    notes: 'Rabies vector species - handle with PPE.',
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
    notes: 'Fluoroquinolone antibiotic. Cartilage damage in juveniles - use cautiously in growing animals.',
  },
  {
    id: 'amoxicillin-clavulanate',
    name: 'Amoxicillin-Clavulanate',
    genericName: 'Amoxicillin + Clavulanic Acid',
    concentrations: [
      { label: '62.5 mg/ml drops (Clavamox)', mgPerMl: 62.5 },
    ],
    defaultRoute: 'PO',
    notes: 'Beta-lactam antibiotic. FATAL in rabbits and many hindgut fermenters - never use in lagomorphs.',
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
  notes: body.notes ?? '',
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
    notes: 'Onset 30–60 min PO. Confirm patient is producing urates before NSAID dosing. First dose may be given IM/SC if oral compliance is poor. AVOID in vultures - Old World vultures have died from related NSAIDs; treat New World species cautiously until species-specific data exists.',
  }),
  rule('meloxicam', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 0.2, max: 0.5, typical: 0.2 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Dilute oral suspension 1:5–1:10 in dextrose 5% or simple syrup for accurate small-volume dosing and palatability. Passerines spit out bitter compounds. Hydrate via SC LRS before dosing if patient is at all dry.',
  }),
  rule('meloxicam', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise', 'GI ulceration'],
    notes: 'Squirrels accept the suspension readily off a syringe. For cottontail kits under 100 g, confirm renal maturity (urinating, normal hydration) before NSAID - kits are more sensitive than adults.',
  }),
  rule('meloxicam', { type: 'species', value: 'red-tailed-hawk' }, {
    mgPerKg: { min: 0.2, max: 0.5, typical: 0.3 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Adult RTHs tolerate 0.5 mg/kg well; juveniles and underweight birds - start at 0.2 mg/kg. Mix into a small piece of fish or quail leg to disguise the bitter taste.',
  }),

  // Carprofen
  rule('carprofen', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 1, max: 3, typical: 1 },
    route: 'IM',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Inject into pectoral muscle - alternate sides between doses. Slower onset than meloxicam; choose meloxicam for acute pain and carprofen for sustained anti-inflammatory (orthopedic cases, wing/leg fractures post-pinning).',
  }),
  rule('carprofen', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 2, max: 4, typical: 2 },
    route: 'SC',
    frequency: 'q12h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'SC into loose skin over the scruff. Squirrels usually need restraint-wrap for SC dosing - a small towel works. Watch for inappetence; pair with assisted feeding if anorexic.',
  }),

  // Buprenorphine
  rule('buprenorphine', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 0.05, max: 0.5, typical: 0.1 },
    route: 'IM',
    frequency: 'q6-12h',
    contraindications: ['Respiratory depression', 'Head trauma (sedation may confound exam)'],
    notes: 'Owls (Strigiformes) show stronger sedative and analgesic response than diurnal raptors at the same mg/kg - start owls at the low end. Onset 30 min; duration 4–8 h. Schedule III - log every dose with date/time/amount/handler per DEA.',
  }),
  rule('buprenorphine', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 0.01, max: 0.05, typical: 0.03 },
    route: 'SC',
    frequency: 'q8-12h',
    contraindications: ['Respiratory depression'],
    notes: 'Lagomorphs (rabbits, cottontails) clear opioids quickly - dose at q6–8h, not q12h, or analgesia gaps. Schedule III - log every dose. Watch respiratory rate for 30 min after first dose.',
  }),

  // Enrofloxacin
  rule('enrofloxacin', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juvenile/growing birds (cartilage)', 'Concurrent NSAID + dehydration'],
    notes: 'Mix into a small piece of fish, mouse, or quail to disguise taste. Watch for crystalluria in any patient with poor urate flow - keep well-hydrated throughout the course. Avoid in growing chicks (fluoroquinolone arthropathy).',
  }),
  rule('enrofloxacin', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 10 },
    contraindications: ['Juvenile/growing birds'],
    notes: 'Dilute oral suspension 1:10 in LRS or sterile water for accurate dosing of birds under 30 g. Drop directly into the back of the mouth or mix with mealworm/insect prey. Not for nestlings.',
  }),
  rule('enrofloxacin', { type: 'species', value: 'eastern-box-turtle' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Severe dehydration (lower renal clearance)'],
    notes: 'Oral via 1 ml syringe into the side of the mouth works well in adult box turtles. Pre-medicate with SC LRS if patient is at all dehydrated - reptile renal clearance drops sharply when dry. Switch SC to oral as soon as eating reliably (injection-site granulomas common with prolonged parenteral dosing).',
  }),

  // Clavamox
  rule('amoxicillin-clavulanate', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 12.5, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Lagomorphs (rabbits)', 'Hindgut fermenters', 'Guinea pigs', 'Chinchillas'],
    notes: 'NEVER give to rabbits, guinea pigs, chinchillas, or any hindgut fermenter - fatal Clostridium difficile / spiroformes overgrowth within 48–72 h. Squirrels and opossums tolerate well; give with food and add a probiotic (Bene-Bac or species-appropriate) on alternating days.',
  }),

  // Itraconazole
  rule('itraconazole', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 14, max: 90 },
    contraindications: ['Hepatic disease', 'Concurrent hepatotoxins'],
    notes: 'First-line for aspergillosis. Compound oral suspension is more reliable than capsule contents - bioavailability is highly variable from capsules. Recheck CBC/biochem every 2 weeks once course exceeds 4 weeks; discontinue if LFTs rise >2× baseline. African Gray-style hypersensitivity also reported rarely in raptors.',
  }),

  // Metronidazole
  rule('metronidazole', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 25, max: 50, typical: 30 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
    notes: 'Treatment of choice for trichomoniasis (frounce) - falconers commonly use 50 mg/kg q24h × 5 d for confirmed lesions. Very bitter; mix with a small piece of fish or rodent. Watch for ataxia at higher doses (neurotoxicity).',
  }),
  rule('metronidazole', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 10, max: 25, typical: 20 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
    notes: 'First-line for Giardia and anaerobic enteritis. Bitter - squirrels often resist; compound with simple syrup or chocolate-flavor base (squirrels and many mammals tolerate cocoa-free chocolate flavors but verify). Give with food.',
  }),

  // Fenbendazole
  rule('fenbendazole', { type: 'group', value: 'raptor' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    contraindications: ['Concurrent severe debility (bone marrow suppression in some species)'],
    notes: 'STRONGLY AVOID in vultures (Old World and New World) - fatal pancytopenia reported. Standard 5-day course clears most nematodes; repeat in 2–3 weeks to catch the next generation. Mix into a meal portion.',
  }),
  rule('fenbendazole', { type: 'group', value: 'smallMammal' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Standard 5-day course. Effective against most squirrel and cottontail GI nematodes. Repeat course in 14 d to catch eggs laid mid-course. Generally well tolerated; rare reports of marrow suppression in some species, so avoid in already-debilitated patients.',
  }),
  rule('fenbendazole', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 50, max: 100, typical: 50 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Higher dose than mammals - reptile metabolism is slower and parasite load tends to be heavier. Repeat course in 2 weeks for full clearance of nematodes. Less reliable for cestodes; consider praziquantel as an alternative.',
  }),

  // ---- WATERFOWL group coverage ----
  rule('meloxicam', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Pre-treat with 20–50 ml/kg SC LRS if patient is at all dehydrated - ducks/geese in care are commonly volume-depleted. Mallards in particular have been reported to develop renal lesions at high doses; use the low end of the range for repeat dosing.',
  }),
  rule('carprofen', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 1, max: 4, typical: 2 },
    route: 'IM',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'IM into pectoral muscle - palpate keel and inject lateral to it. Use for orthopedic pain (wing fractures from collisions are common). Slower onset than meloxicam.',
  }),
  rule('enrofloxacin', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juvenile/growing birds (cartilage)'],
    notes: 'Mix with feed or float on water as duck-friendly suspension. Adults take medicated pellets readily once acclimated. Avoid in ducklings/goslings still in cartilage growth.',
  }),
  rule('metronidazole', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 20, max: 50, typical: 30 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
    notes: 'For Hexamita and trichomoniasis in waterfowl. Mix into feed; bitter taste reduces voluntary intake - direct gavage may be needed for severe cases.',
  }),
  rule('itraconazole', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 14, max: 60 },
    contraindications: ['Hepatic disease'],
    notes: 'Aspergillosis is a major killer of seabirds and waterfowl in rehab - keep enclosures dry, well-ventilated, and prophylax high-risk patients (oiled birds, long-term care). Monitor LFTs every 2 weeks on courses >4 weeks. Mallards reportedly have a lower hepatotoxicity threshold than other ducks; start at 5 mg/kg.',
  }),
  rule('fenbendazole', { type: 'group', value: 'waterfowl' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Covers gizzard worms (Tetrameres, Cyathostoma) and most GI nematodes. Repeat course in 14 d. Mix into feed.',
  }),

  // ---- WADING-BIRD group coverage ----
  rule('meloxicam', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 0.5, max: 1.0, typical: 0.5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Herons and egrets are usually dehydrated on intake - fluid-resuscitate before NSAID dosing. SC or IM route preferred for the first dose since herons often refuse oral meds without a fish carrier.',
  }),
  rule('carprofen', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 1, max: 3, typical: 2 },
    route: 'IM',
    frequency: 'q24h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'IM into pectoral. Useful for fishing-line / fishhook injury pain. Pair with an opioid for acute injury cases.',
  }),
  rule('enrofloxacin', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 15, max: 20, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juvenile/growing birds'],
    notes: 'Oral gavage via flexible tube is the most reliable route in herons - they will not voluntarily eat medicated fish. Hide in a fish if voluntarily feeding. IM is irritating in wading-bird pectorals; avoid.',
  }),
  rule('itraconazole', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 14, max: 60 },
    contraindications: ['Hepatic disease'],
    notes: 'Aspergillosis common in rehab herons after prolonged hospitalization. Compound oral suspension; gavage if voluntary intake is poor. Monitor LFTs every 2 weeks.',
  }),
  rule('fenbendazole', { type: 'group', value: 'wadingBird' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Hide in a fish for voluntary intake; otherwise gavage. Repeat in 14 d for full nematode clearance.',
  }),

  // ---- MEDIUM-MAMMAL group coverage (opossums, raccoons) ----
  rule('meloxicam', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 0.1, max: 0.3, typical: 0.2 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise', 'GI ulceration'],
    notes: 'Allometric scaling - larger body mass means lower mg/kg than rodent dosing. Opossums tolerate well; raccoons variable. Give with food when possible to reduce GI upset. Always hydrate first.',
  }),
  rule('carprofen', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 2, max: 4, typical: 2 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Same protocol as carnivore canid dosing. Take with food. Useful for orthopedic injury (HBC raccoons, traumatic opossum injuries). Watch appetite - anorexia warrants discontinuation.',
  }),
  rule('buprenorphine', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 0.01, max: 0.03, typical: 0.02 },
    route: 'SC',
    frequency: 'q8-12h',
    contraindications: ['Respiratory depression'],
    notes: 'SC over scruff or flank. Schedule III - log every dose. Raccoons under buprenorphine become more cooperative for wound care; useful pre-bandage-change. Use PPE - rabies-vector species.',
  }),
  rule('enrofloxacin', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 5, max: 15, typical: 10 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Juveniles (cartilage)', 'Severe dehydration'],
    notes: 'Start raccoons at 5 mg/kg - some references cite transient hypersensitivity at higher doses. Opossums tolerate the full range. Take with food.',
  }),
  rule('amoxicillin-clavulanate', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 12.5, max: 22, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Concurrent severe diarrhea'],
    notes: 'Carnivore beta-lactam protocol applies - well tolerated in opossums and raccoons. Give with food. Watch stool quality; if soft stools develop, add a probiotic. Useful for bite wounds, abscesses, dental disease.',
  }),
  rule('metronidazole', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 10, max: 25, typical: 15 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
    notes: 'For Giardia and anaerobic infections (bite-wound abscesses, dental disease). Bitter; mix with strongly-flavored food (canned cat food works well for raccoons). Watch for ataxia at higher doses or extended courses.',
  }),
  rule('fenbendazole', { type: 'group', value: 'mediumMammal' }, {
    mgPerKg: { min: 20, max: 50, typical: 50 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Standard parasiticide. Raccoons commonly carry Baylisascaris procyonis - zoonotic and serious; handle feces with PPE during treatment. Repeat course in 14 d. Effective against most other nematodes; less reliable for cestodes.',
  }),

  // ---- SONGBIRD additions ----
  rule('carprofen', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 1, max: 4, typical: 2 },
    route: 'IM',
    frequency: 'q12h',
    durationDays: { min: 1, max: 3 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Very small volume - use a 0.5 ml insulin syringe and dilute injectable carprofen 1:5 in sterile saline for accuracy. Injection-site bruising common; rotate sites.',
  }),
  rule('itraconazole', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 5, max: 10, typical: 5 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 14, max: 30 },
    contraindications: ['Hepatic disease'],
    notes: 'Compound suspension at 5–10 mg/ml is essential - capsule contents are unreliable in tiny passerines. Useful for aspergillosis and candidiasis. Watch for vomiting (rare) and weight loss; weigh weekly.',
  }),
  rule('metronidazole', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q12h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease'],
    notes: 'Trichomoniasis (esp. mourning doves, house finches) and giardiasis. Dilute oral suspension 1:5 in dextrose 5% for accurate small-volume dosing. Watch for ataxia at higher doses.',
  }),
  rule('fenbendazole', { type: 'group', value: 'songbird' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24h',
    durationDays: { min: 3, max: 5 },
    notes: 'Covers Capillaria, Syngamus, and Ascaridia. Mix into mealworm slurry for insectivores. Repeat course in 14 d.',
  }),

  // ---- REPTILE additions ----
  rule('meloxicam', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 },
    route: 'PO',
    frequency: 'q24-48h',
    durationDays: { min: 1, max: 5 },
    contraindications: ['Dehydration', 'Renal compromise'],
    notes: 'Slower clearance than mammals/birds - q24h adequate for chelonians and most lizards, q48h for snakes. Analgesic effect may take 24 h to manifest after first dose. Hydrate well; reptile renal function drops sharply when dry.',
  }),
  rule('enrofloxacin', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 5, max: 10, typical: 10 },
    route: 'PO',
    frequency: 'q24-48h',
    durationDays: { min: 7, max: 14 },
    contraindications: ['Severe dehydration'],
    notes: 'Frequency varies by taxon - most snakes q48h, turtles q24h, small lizards q24h. SC injection causes painful granulomas in many species; oral preferred whenever possible. Avoid in juveniles.',
  }),
  rule('metronidazole', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 20, max: 50, typical: 25 },
    route: 'PO',
    frequency: 'q24-48h',
    durationDays: { min: 5, max: 10 },
    contraindications: ['Hepatic disease', 'Snakes (some species sensitive - start low)'],
    notes: 'For amoebic infections (esp. in chelonians) and anaerobic infections. Indigo snakes, kingsnakes, and milk snakes have shown neurotoxicity at >40 mg/kg - start at 20 mg/kg for any colubrid. Watch for tremors or hindlimb paresis.',
  }),
  rule('buprenorphine', { type: 'group', value: 'reptile' }, {
    mgPerKg: { min: 0.02, max: 0.2, typical: 0.05 },
    route: 'IM',
    frequency: 'q24-48h',
    contraindications: ['Respiratory depression'],
    notes: 'Reptile opioid pharmacology is highly variable. Chelonians often show poor buprenorphine response - many clinicians use morphine (1.5 mg/kg IM) or hydromorphone instead. Snakes and lizards more reliably responsive. Schedule III - log every dose.',
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
