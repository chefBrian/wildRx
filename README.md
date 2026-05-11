# wildRx

Wildlife medication dosing calculator for Georgia wildlife rehabilitation. A PWA with a public calculator (pick a med → pick a species → enter weight → get a dose) and an authenticated admin UI for editing medications, species, and dosing rules.

> ⚠️ **Starter clinical data.** Dose values shipped with this project are reasonable starter ranges drawn from common rehab references. Verify against your hospital's current protocols and have your supervising vet review before clinical use.

## Stack

React 19 · TypeScript · Vite 8 · Tailwind v3 · react-router v7 · Firebase (Firestore + Auth + Hosting) · Fuse.js · vite-plugin-pwa · Vitest + Testing Library

## Quick start

```bash
npm install
cp .env.example .env.local       # then fill in your VITE_FIREBASE_* values
npm run dev                      # http://localhost:5173
```

To seed Firestore with starter species, medications, and dosing rules:

```bash
gcloud auth application-default login   # one-time
node scripts/seed.mjs
```

The seed script uses the Firebase Admin SDK and bypasses security rules. It's idempotent — re-running overwrites docs by stable slug ID.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | Preview the production build |
| `npm test` | Vitest watch mode |
| `npm run test:run` | Vitest single run |
| `npm run lint` | ESLint |

## Project layout

```
src/
  routes/
    CalculatorHome.tsx       # public landing: pick a medication
    calculator/              # species + weight → dose result
    admin/                   # lazy-loaded CRUD (meds, species, rules)
  domain/                    # pure logic (dose math, rule resolution, types)
  firebase/
    client.ts                # exports `db` only (keeps firebase/auth out of main bundle)
    auth.ts                  # auth + RequireAuth helpers (admin-only chunk)
    repos.ts                 # Firestore read/write helpers
  auth/                      # AuthProvider, RequireAuth
  components/                # shared UI (TypeaheadSelect, ConfirmDialog, ...)
scripts/seed.mjs             # Firestore seeder
firestore.rules              # public-read, auth-write
firebase.json                # Hosting + Firestore config
```

The `/admin/*` route is code-split via `React.lazy`, so the public calculator does not load `firebase/auth` (~80 KiB).

## Data model

Three Firestore collections, all public-read and auth-required-write:

- **`medications`** — name, generic name, concentrations (`mg/ml`), default route, notes
- **`species`** — common + scientific name, taxonomic group, typical weight range
- **`dosingRules`** — `{ medicationId, target: { type: 'group' | 'species', value }, mgPerKg: {min, typical, max}, route, frequency, durationDays, contraindications, notes }`

Rule IDs follow `${medicationId}__${target.type}-${target.value}` so re-seeding stays idempotent.

Rule resolution (`src/domain/resolveRules.ts`): species-specific rules shadow group rules. If a species rule exists for a medication, the group default for that species is hidden.

## Deployment

```bash
npm run build
firebase deploy
```

`firebase.json` configures `dist/` as the hosting target with an SPA rewrite to `/index.html`, and points Firestore at `firestore.rules` and `firestore.indexes.json`.

## Contributing

Tests live next to source as `*.test.ts(x)`. Run `npm run test:run && npm run build` before opening a PR — the build does the TS type-check, which CI does not duplicate. See [CLAUDE.md](CLAUDE.md) for architectural gotchas (bundle splits, rule-resolution semantics, unit conventions).
