import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeciesEditor } from './SpeciesEditor';
import * as repos from '../../../firebase/repos';
import type { DosingRule, Medication, RuleTarget, Species } from '../../../domain/types';

vi.mock('../../../firebase/repos', () => {
  class SpeciesExistsError extends Error {}
  return { upsertSpecies: vi.fn(), createSpecies: vi.fn(), SpeciesExistsError };
});

const hawk: Species = { id: 'red-tailed-hawk', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } };
const blank: Species = { id: '', commonName: '', scientificName: '', group: 'raptor', typicalWeightKg: { min: 0, max: 0 } };
const baytril: Medication = { id: 'baytril', name: 'Baytril', doseUnit: 'mg', concentrations: [] };
const rule = (medicationId: string, target: RuleTarget): DosingRule => ({
  id: `${medicationId}__${target.type}-${target.value}__PO`, medicationId, target, route: 'PO',
  dosePerKg: { min: 1, typical: 1, max: 1 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});

beforeEach(() => {
  vi.mocked(repos.upsertSpecies).mockReset().mockResolvedValue(undefined);
  vi.mocked(repos.createSpecies).mockReset().mockResolvedValue(undefined);
});

function renderEditor(species: Species, extra: { allSpecies?: Species[]; meds?: Medication[]; rules?: DosingRule[]; onSaved?: (s: Species) => void } = {}) {
  render(
    <SpeciesEditor
      species={species}
      allSpecies={extra.allSpecies ?? [hawk]}
      meds={extra.meds ?? []}
      rules={extra.rules ?? []}
      onSaved={extra.onSaved ?? (() => {})}
      onCancel={() => {}}
    />
  );
}

describe('SpeciesEditor', () => {
  it('gives a new species a slug id from its common name', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderEditor(blank, { onSaved });
    await user.type(screen.getByLabelText('Common name'), "Cooper's Hawk");
    expect(screen.getByText('Id: cooper-s-hawk')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(repos.createSpecies).toHaveBeenCalledWith(expect.objectContaining({ id: 'cooper-s-hawk', commonName: "Cooper's Hawk" }));
    expect(repos.upsertSpecies).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'cooper-s-hawk' }));
  });

  it('blocks a slug that is already taken', async () => {
    const user = userEvent.setup();
    renderEditor(blank);
    await user.type(screen.getByLabelText('Common name'), 'Red-tailed Hawk');
    expect(screen.getByText('A species with id red-tailed-hawk already exists.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('blocks an empty common name', () => {
    renderEditor(blank, { allSpecies: [] });
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('keeps the id when an existing species is renamed', async () => {
    const user = userEvent.setup();
    renderEditor(hawk);
    await user.clear(screen.getByLabelText('Common name'));
    await user.type(screen.getByLabelText('Common name'), 'Red-tail');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(repos.upsertSpecies).toHaveBeenCalledWith(expect.objectContaining({ id: 'red-tailed-hawk', commonName: 'Red-tail' }));
  });

  it('says so when a concurrent create took the same slug', async () => {
    vi.mocked(repos.createSpecies).mockRejectedValueOnce(new repos.SpeciesExistsError('wood-stork'));
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderEditor(blank, { allSpecies: [], onSaved });
    await user.type(screen.getByLabelText('Common name'), 'Wood Stork');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText('A species with this name already exists.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });

  it('warns when old rules already target the new id', async () => {
    const user = userEvent.setup();
    renderEditor(blank, { allSpecies: [], rules: [rule('baytril', { type: 'species', value: 'wood-stork' })] });
    await user.type(screen.getByLabelText('Common name'), 'Wood Stork');
    expect(screen.getByText('1 existing rule already targets wood-stork and will apply to this species.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });

  it('shows what a group change does to doses before saving', async () => {
    const user = userEvent.setup();
    renderEditor(hawk, { meds: [baytril], rules: [rule('baytril', { type: 'group', value: 'raptor' })] });
    expect(screen.queryByText(/moving red-tailed hawk/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Group'), 'songbird');
    expect(screen.getByText('Moving Red-tailed Hawk to Songbird leaves 1 med with no rule.')).toBeInTheDocument();
  });

  it('shows a failed save and lets the admin retry', async () => {
    vi.mocked(repos.upsertSpecies).mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderEditor(hawk, { onSaved });
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByText('Save failed: Missing or insufficient permissions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('disables Cancel while a save is in flight', async () => {
    vi.mocked(repos.upsertSpecies).mockReturnValueOnce(new Promise<void>(() => {}));
    const user = userEvent.setup();
    renderEditor(hawk);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
