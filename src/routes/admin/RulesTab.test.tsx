import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RulesTab } from './RulesTab';
import * as repos from '../../firebase/repos';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import type { DosingRule } from '../../domain/types';

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn(),
  listSpecies: vi.fn(),
  listDosingRulesForMed: vi.fn(),
  upsertDosingRule: vi.fn().mockResolvedValue(undefined),
  deleteDosingRule: vi.fn().mockResolvedValue(undefined),
}));

const existingRule: DosingRule = {
  id: 'vita__group-reptile', medicationId: 'vita', target: { type: 'group', value: 'reptile' },
  dosePerKg: { min: 1000, typical: 1500, max: 2000 }, route: 'IM', frequency: 'q7d',
  durationDays: null, maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: 'u1',
};

beforeEach(() => {
  vi.mocked(repos.listMedications).mockResolvedValue([
    { id: 'vita', name: 'Vitamin A', doseUnit: 'IU', concentrations: [{ id: 'c1', value: 50000, form: 'injectable' }] },
  ] as Awaited<ReturnType<typeof repos.listMedications>>);
  vi.mocked(repos.listSpecies).mockResolvedValue([
    { id: 'ebt', commonName: 'Eastern Box Turtle', scientificName: 'Terrapene carolina', group: 'reptile', typicalWeightKg: { min: 0.3, max: 0.5 } },
  ] as Awaited<ReturnType<typeof repos.listSpecies>>);
  vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([existingRule]);
  vi.mocked(repos.upsertDosingRule).mockClear();
});

describe('RulesTab', () => {
  it('labels doses in the med unit and says per dose', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    expect(screen.getByText('Dose per kg, per dose (IU/kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Max single dose (IU, blank = none)')).toBeInTheDocument();
  });

  it('previews at the target typical weight range and flags unmeasurable volumes', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    // 0.3 kg × 1500 = 450 IU ÷ 50,000 = 0.009 ml (too small); 0.5 kg → 750 IU = 0.015 ml
    expect(screen.getByText(/^0\.3 kg: 450 IU = 0\.009 ml @ 50,000 IU\/ml \(too small to measure\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^0\.5 kg: 750 IU = 0\.015 ml @ 50,000 IU\/ml$/)).toBeInTheDocument();
  });

  it('disables Save when typical is blank', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    await user.clear(screen.getByLabelText('Typical'));
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('saves blank min and max as typical', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    await user.clear(screen.getByLabelText('Min'));
    await user.clear(screen.getByLabelText('Max'));
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(repos.upsertDosingRule).toHaveBeenCalledWith(expect.objectContaining({
      dosePerKg: { min: 1500, typical: 1500, max: 1500 },
    }));
  });

  it('saves a dose typed with a leading zero exactly', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    await user.clear(screen.getByLabelText('Min'));
    await user.clear(screen.getByLabelText('Max'));
    await user.clear(screen.getByLabelText('Typical'));
    await user.type(screen.getByLabelText('Typical'), '0.01');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(repos.upsertDosingRule).toHaveBeenCalledWith(expect.objectContaining({
      dosePerKg: { min: 0.01, typical: 0.01, max: 0.01 },
    }));
  });

  it('explains old-format rules instead of going blank', async () => {
    vi.mocked(repos.listDosingRulesForMed).mockRejectedValueOnce(new SchemaMismatchError('dosingRules', 'r1'));
    const user = userEvent.setup();
    render(<RulesTab />);
    await waitFor(() => screen.getByRole('option', { name: 'Vitamin A' }));
    await user.selectOptions(screen.getByLabelText(/medication/i), 'vita');
    expect(await screen.findByText(/rules in an old format/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add rule/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/no rules yet/i)).not.toBeInTheDocument();
  });

  it('rejects unparseable Max instead of saving it as typical', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    await user.clear(screen.getByLabelText('Max'));
    await user.type(screen.getByLabelText('Max'), '2,000');
    expect(screen.getByText('Enter a plain number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('rejects a negative Min', async () => {
    const user = userEvent.setup();
    await openExisting(user);
    await user.clear(screen.getByLabelText('Min'));
    await user.type(screen.getByLabelText('Min'), '-5');
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('closes the edit panel when the medication changes', async () => {
    vi.mocked(repos.listMedications).mockResolvedValue([
      { id: 'vita', name: 'Vitamin A', doseUnit: 'IU', concentrations: [] },
      { id: 'other', name: 'Other', doseUnit: 'mg', concentrations: [] },
    ] as Awaited<ReturnType<typeof repos.listMedications>>);
    const user = userEvent.setup();
    render(<RulesTab />);
    await waitFor(() => screen.getByRole('option', { name: 'Vitamin A' }));
    await user.selectOptions(screen.getByLabelText(/medication/i), 'vita');
    await user.click(await screen.findByRole('button', { name: /add rule/i }));
    expect(screen.getByText('New rule')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/medication/i), 'other');
    expect(screen.queryByText('New rule')).not.toBeInTheDocument();
  });
});

async function openExisting(user: ReturnType<typeof userEvent.setup>) {
  render(<RulesTab />);
  await waitFor(() => screen.getByRole('option', { name: 'Vitamin A' }));
  await user.selectOptions(screen.getByLabelText(/medication/i), 'vita');
  await waitFor(() => screen.getByText(/1,000–2,000 IU\/kg/));
  await user.click(screen.getByRole('button', { name: /edit/i }));
}
