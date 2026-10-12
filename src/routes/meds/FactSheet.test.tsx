import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FactSheet } from './FactSheet';
import * as repos from '../../firebase/repos';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import type { DosingRule, Medication, RuleTarget, Species } from '../../domain/types';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn(), listSpecies: vi.fn(), listDosingRulesForMed: vi.fn(),
}));

const sp = (id: string, commonName: string, group: Species['group']): Species => ({
  id, commonName, scientificName: '', group, typicalWeightKg: { min: 1, max: 2 },
});
const rule = (target: RuleTarget, route: DosingRule['route'], over: Partial<DosingRule> = {}): DosingRule => ({
  id: `melox__${target.type}-${target.value}__${route}`, medicationId: 'melox', target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '', ...over,
});
const meloxicam: Medication = {
  id: 'melox', name: 'Meloxicam', genericName: 'Meloxicam', doseUnit: 'mg', notes: 'NSAID.',
  concentrations: [
    { id: 'o', value: 1.5, form: 'oral', note: 'Metacam' },
    { id: 'i', value: 5, form: 'injectable', routes: ['IM', 'SC'] },
  ],
};
const raptor: RuleTarget = { type: 'group', value: 'raptor' };

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([
    meloxicam,
    { id: 'pepto', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [], productDescription: 'Pepto-Bismol Original (17.5 mg/ml)' },
  ]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([sp('rth', 'Red-tailed Hawk', 'raptor'), sp('robin', 'American Robin', 'songbird')]);
  vi.mocked(repos.listDosingRulesForMed).mockReset().mockResolvedValue([
    rule(raptor, 'PO', { contraindications: ['Dehydration', 'Renal compromise'] }),
    rule(raptor, 'SC'),
    rule({ type: 'species', value: 'rth' }, 'PO'),
    rule({ type: 'group', value: 'songbird' }, 'IV'),
    rule({ type: 'species', value: 'deleted-hawk' }, 'PO'),
  ]);
});

function renderAt(entries: string[] = ['/meds/melox']) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/meds/:medId" element={<FactSheet />} />
        <Route path="/meds" element={<div>INDEX</div>} />
        <Route path="/dose/x" element={<div>RESULT</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('FactSheet', () => {
  it('shows bottles with their routes and the med notes', async () => {
    renderAt();
    expect(await screen.findByText('1.5 mg/ml · oral · Metacam')).toBeInTheDocument();
    expect(screen.getByText('Can be given by: PO')).toBeInTheDocument();
    expect(screen.getByText('Can be given by: IM, SC')).toBeInTheDocument();
    expect(screen.getByText('NSAID.')).toBeInTheDocument();
  });

  it('groups rules by group with species rules and their labels', async () => {
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Raptor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Songbird' })).toBeInTheDocument();
    expect(screen.getByText('Replaces the Raptor rules for this species.')).toBeInTheDocument();
    expect(screen.getByText('No SC dose for this species.')).toBeInTheDocument();
  });

  it('shows full contraindications', async () => {
    renderAt();
    const row = await screen.findByTestId('rule-melox__group-raptor__PO');
    expect(within(row).getByText('Dehydration')).toBeInTheDocument();
    expect(within(row).getByText('Renal compromise')).toBeInTheDocument();
  });

  it('tags a rule whose route no bottle allows', async () => {
    renderAt();
    const row = await screen.findByTestId('rule-melox__group-songbird__IV');
    expect(within(row).getByText('No bottle on file for IV')).toBeInTheDocument();
  });

  it('keeps rules for a deleted species under Other rules', async () => {
    renderAt();
    expect(await screen.findByRole('heading', { name: 'Other rules' })).toBeInTheDocument();
    expect(screen.getByTestId('rule-melox__species-deleted-hawk__PO')).toBeInTheDocument();
  });

  it('shows the product for an ml med', async () => {
    vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([]);
    renderAt(['/meds/pepto']);
    expect(await screen.findByText('Pepto-Bismol Original (17.5 mg/ml)')).toBeInTheDocument();
    expect(screen.getByText('No dosing rules yet. Ask a vet.')).toBeInTheDocument();
  });

  it('says when the medication is not found', async () => {
    renderAt(['/meds/nope']);
    expect(await screen.findByText(/medication not found/i)).toBeInTheDocument();
  });

  it('shows the update notice for old-shape rules', async () => {
    vi.mocked(repos.listDosingRulesForMed).mockRejectedValueOnce(new SchemaMismatchError('dosingRules', 'r1'));
    renderAt();
    expect(await screen.findByText(/data update in progress/i)).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    vi.mocked(repos.listSpecies).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderAt();
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: 'Raptor' })).toBeInTheDocument();
  });

  it('goes back to where the user came from inside the app', async () => {
    const user = userEvent.setup();
    renderAt(['/dose/x', '/meds/melox']);
    await user.click(await screen.findByRole('button', { name: /back/i }));
    expect(await screen.findByText('RESULT')).toBeInTheDocument();
  });

  it('links back to the index when opened directly', async () => {
    renderAt();
    expect(await screen.findByRole('link', { name: /back/i })).toHaveAttribute('href', '/meds');
  });
});
