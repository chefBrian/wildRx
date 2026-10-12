import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeciesPage } from './SpeciesPage';
import * as repos from '../../../firebase/repos';
import { SchemaMismatchError } from '../../../firebase/schemaGuard';
import type { DosingRule, Medication, RuleTarget, Species } from '../../../domain/types';

vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('../../../firebase/repos', () => {
  class RuleExistsError extends Error {
    readonly id: string;
    constructor(id: string) { super(id); this.id = id; }
  }
  return {
    RuleExistsError,
    listMedications: vi.fn(), listSpecies: vi.fn(), listAllDosingRules: vi.fn(),
    createDosingRule: vi.fn(), createDosingRules: vi.fn(), upsertDosingRule: vi.fn(),
    rekeyDosingRule: vi.fn(), deleteDosingRule: vi.fn(), deleteSpecies: vi.fn(), upsertSpecies: vi.fn(), createSpecies: vi.fn(),
    listDosingRulesForSpecies: vi.fn(),
  };
});

const sp = (id: string, commonName: string): Species => ({
  id, commonName, scientificName: `${commonName} sci`, group: 'raptor', typicalWeightKg: { min: 0.5, max: 1.5 },
});
const hawk = sp('rth', 'Red-tailed Hawk');
const owl = sp('bo', 'Barred Owl');
const med = (id: string, name: string): Medication => ({ id, name, doseUnit: 'mg', concentrations: [] });
const rule = (medicationId: string, target: RuleTarget, route: DosingRule['route']): DosingRule => ({
  id: `${medicationId}__${target.type}-${target.value}__${route}`, medicationId, target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});
const raptor: RuleTarget = { type: 'group', value: 'raptor' };
const meloxGroupPO = rule('melox', raptor, 'PO');
const meloxGroupSC = rule('melox', raptor, 'SC');
const meloxHawkPO = rule('melox', { type: 'species', value: 'rth' }, 'PO');
const baytrilGroupPO = rule('baytril', raptor, 'PO');
const RULES = [meloxGroupPO, meloxGroupSC, meloxHawkPO, baytrilGroupPO];

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([med('melox', 'Meloxicam'), med('baytril', 'Baytril'), med('prazi', 'Praziquantel')]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([hawk, owl]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue(RULES);
  vi.mocked(repos.createDosingRules).mockReset().mockResolvedValue(undefined);
  vi.mocked(repos.deleteDosingRule).mockReset().mockResolvedValue(undefined);
  vi.mocked(repos.deleteSpecies).mockReset().mockResolvedValue(undefined);
  vi.mocked(repos.listDosingRulesForSpecies).mockReset().mockResolvedValue([]);
});

function renderPage(id = 'rth') {
  return render(
    <MemoryRouter initialEntries={[`/admin/animals/species/${id}`]}>
      <Routes>
        <Route path="/admin/animals/species/:speciesId" element={<SpeciesPage />} />
        <Route path="/admin" element={<div>ADMIN HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SpeciesPage', () => {
  it('shows the rules in effect with their source', async () => {
    renderPage();
    const own = await screen.findByTestId('rule-melox__species-rth__PO');
    expect(within(own).getByText('species')).toBeInTheDocument();
    expect(within(screen.getByTestId('rule-baytril__group-raptor__PO')).getByText('Raptor')).toBeInTheDocument();
  });

  it('shows the group rules a species rule hides, dimmed', async () => {
    renderPage();
    expect(await screen.findByText('Hidden by species rule:')).toBeInTheDocument();
    expect(screen.getByTestId('rule-melox__group-raptor__PO')).toHaveClass('opacity-60');
    expect(screen.getByTestId('rule-melox__group-raptor__SC')).toHaveClass('opacity-60');
  });

  it('says how many species a group rule applies to', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Edit Raptor rule - applies to 2 species' })).toBeInTheDocument();
  });

  it('copies every group route on override, then opens the editor', async () => {
    const copy = rule('baytril', { type: 'species', value: 'rth' }, 'PO');
    vi.mocked(repos.listAllDosingRules).mockResolvedValueOnce(RULES).mockResolvedValue([...RULES, copy]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /override for this species/i }));
    expect(screen.getByText(/copies the raptor po rule to red-tailed hawk/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /copy rules/i }));
    expect(repos.createDosingRules).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'baytril__species-rth__PO', target: { type: 'species', value: 'rth' }, dosePerKg: baytrilGroupPO.dosePerKg }),
    ]);
    expect(await screen.findByText('Edit rule')).toBeInTheDocument();
  });

  it('copies both routes when overriding from the SC row, then opens the SC copy', async () => {
    const owlTarget: RuleTarget = { type: 'species', value: 'bo' };
    vi.mocked(repos.listAllDosingRules).mockResolvedValueOnce(RULES)
      .mockResolvedValue([...RULES, rule('melox', owlTarget, 'PO'), rule('melox', owlTarget, 'SC')]);
    const user = userEvent.setup();
    renderPage('bo');
    const sc = await screen.findByTestId('rule-melox__group-raptor__SC');
    await user.click(within(sc).getByRole('button', { name: /override for this species/i }));
    expect(screen.getByText(/copies the raptor po and sc rules to barred owl/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /copy rules/i }));
    expect(repos.createDosingRules).toHaveBeenCalledTimes(1);
    expect(repos.createDosingRules).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'melox__species-bo__PO', dosePerKg: meloxGroupPO.dosePerKg, maxSingleDose: null, frequency: 'q24h' }),
      expect.objectContaining({ id: 'melox__species-bo__SC', dosePerKg: meloxGroupSC.dosePerKg, maxSingleDose: null, frequency: 'q24h' }),
    ]);
    expect(await screen.findByText('Edit rule')).toBeInTheDocument();
    expect(screen.getByLabelText('Route')).toHaveValue('SC');
  });

  it('offers only this species when adding a route to a med in effect via species rules', async () => {
    const user = userEvent.setup();
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Meloxicam' });
    await user.click(within(heading.parentElement!.parentElement!).getByRole('button', { name: /add route/i }));
    expect(screen.getByText('New rule')).toBeInTheDocument();
    expect(screen.queryByLabelText('Applies to')).not.toBeInTheDocument();
  });

  it('warns what a species falls back to when its last rule is deleted', async () => {
    const user = userEvent.setup();
    renderPage();
    const own = await screen.findByTestId('rule-melox__species-rth__PO');
    await user.click(within(own).getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/Red-tailed Hawk will fall back to the Raptor PO and SC rules for Meloxicam\./)).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(repos.deleteDosingRule).toHaveBeenCalledWith('melox__species-rth__PO');
  });

  it('lists meds with no rule, with an add button defaulting to this species', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /add rule for praziquantel/i }));
    expect(screen.getByText('New rule')).toBeInTheDocument();
    expect(screen.getByLabelText('Applies to')).toHaveValue('species:rth');
  });

  it('blocks deleting a species that still has its own rules', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /delete species/i })).toBeDisabled();
    expect(screen.getByText(/delete the 1 species rule for red-tailed hawk first: meloxicam po/i)).toBeInTheDocument();
  });

  it('deletes a species with no rules of its own', async () => {
    const user = userEvent.setup();
    renderPage('bo');
    await user.click(await screen.findByRole('button', { name: /delete species/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(repos.deleteSpecies).toHaveBeenCalledWith('bo');
    expect(await screen.findByText('ADMIN HOME')).toBeInTheDocument();
  });

  it('explains an unknown species', async () => {
    renderPage('nope');
    expect(await screen.findByText(/species not found/i)).toBeInTheDocument();
  });

  it('explains old-format rules', async () => {
    vi.mocked(repos.listAllDosingRules).mockRejectedValueOnce(new SchemaMismatchError('dosingRules', 'x'));
    renderPage();
    await waitFor(() => expect(screen.getByText(/old format/i)).toBeInTheDocument());
  });

  it('shows a failed rule delete', async () => {
    vi.mocked(repos.deleteDosingRule).mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    const user = userEvent.setup();
    renderPage();
    const own = await screen.findByTestId('rule-melox__species-rth__PO');
    await user.click(within(own).getByRole('button', { name: /delete/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText('Delete failed: Missing or insufficient permissions.')).toBeInTheDocument();
  });

  it('shows a failed override copy', async () => {
    vi.mocked(repos.createDosingRules).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /override for this species/i }));
    await user.click(screen.getByRole('button', { name: /copy rules/i }));
    expect(await screen.findByText('Override failed: offline')).toBeInTheDocument();
  });

  it('stays on the page when deleting the species fails', async () => {
    vi.mocked(repos.deleteSpecies).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderPage('bo');
    await user.click(await screen.findByRole('button', { name: /delete species/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText('Delete failed: offline')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN HOME')).not.toBeInTheDocument();
  });

  it('re-checks the species rules on confirm and refuses when one appeared since the page loaded', async () => {
    vi.mocked(repos.listDosingRulesForSpecies).mockResolvedValue([rule('baytril', { type: 'species', value: 'bo' }, 'PO')]);
    const user = userEvent.setup();
    renderPage('bo');
    await user.click(await screen.findByRole('button', { name: /delete species/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText(/delete the 1 species rule for barred owl first: baytril po/i)).toBeInTheDocument();
    expect(repos.listDosingRulesForSpecies).toHaveBeenCalledWith('bo');
    expect(repos.deleteSpecies).not.toHaveBeenCalled();
    expect(screen.queryByText('ADMIN HOME')).not.toBeInTheDocument();
    await waitFor(() => expect(repos.listAllDosingRules).toHaveBeenCalledTimes(2)); // page data reloaded
  });

  it('does not delete when the fresh rule check fails', async () => {
    vi.mocked(repos.listDosingRulesForSpecies).mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    renderPage('bo');
    await user.click(await screen.findByRole('button', { name: /delete species/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText('Delete failed: offline')).toBeInTheDocument();
    expect(repos.deleteSpecies).not.toHaveBeenCalled();
  });

  it('lists rules whose medication was deleted and deletes one', async () => {
    const orphan = rule('gone-med', { type: 'species', value: 'bo' }, 'IM');
    vi.mocked(repos.listAllDosingRules).mockResolvedValue([...RULES, orphan]);
    const user = userEvent.setup();
    renderPage('bo');
    const section = (await screen.findByRole('heading', { name: 'Rules for deleted medications' })).closest('section')!;
    expect(within(section).getByText(/gone-med/)).toBeInTheDocument();
    expect(within(section).getByText(/IM/)).toBeInTheDocument();
    await user.click(within(section).getByRole('button', { name: /delete/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(repos.deleteDosingRule).toHaveBeenCalledWith(orphan.id);
  });

  it('shows no deleted-medication section when every rule has its medication', async () => {
    renderPage();
    await screen.findByTestId('rule-melox__species-rth__PO');
    expect(screen.queryByRole('heading', { name: 'Rules for deleted medications' })).not.toBeInTheDocument();
  });

  it('keeps the page and offers Try again when a refresh after a change fails', async () => {
    vi.mocked(repos.listAllDosingRules).mockResolvedValueOnce(RULES).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderPage();
    const own = await screen.findByTestId('rule-melox__species-rth__PO');
    await user.click(within(own).getByRole('button', { name: /delete/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText(/couldn't refresh\. the page may be out of date\./i)).toBeInTheDocument();
    expect(screen.getByTestId('rule-baytril__group-raptor__PO')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.queryByText(/couldn't refresh/i)).not.toBeInTheDocument());
    expect(screen.getByTestId('rule-baytril__group-raptor__PO')).toBeInTheDocument();
  });
});
