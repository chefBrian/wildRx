import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroupPage } from './GroupPage';
import * as repos from '../../../firebase/repos';
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
    createDosingRule: vi.fn(), upsertDosingRule: vi.fn(), rekeyDosingRule: vi.fn(), deleteDosingRule: vi.fn(),
  };
});

const sp = (id: string, commonName: string): Species => ({
  id, commonName, scientificName: '', group: 'raptor', typicalWeightKg: { min: 0.5, max: 1.5 },
});
const med = (id: string, name: string): Medication => ({ id, name, doseUnit: 'mg', concentrations: [] });
const rule = (medicationId: string, target: RuleTarget, route: DosingRule['route']): DosingRule => ({
  id: `${medicationId}__${target.type}-${target.value}__${route}`, medicationId, target, route,
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});
const raptor: RuleTarget = { type: 'group', value: 'raptor' };

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([med('melox', 'Meloxicam'), med('baytril', 'Baytril'), med('prazi', 'Praziquantel')]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([sp('rth', 'Red-tailed Hawk'), sp('bo', 'Barred Owl')]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue([
    rule('melox', raptor, 'PO'), rule('melox', raptor, 'SC'),
    rule('melox', { type: 'species', value: 'rth' }, 'PO'),
    rule('baytril', raptor, 'PO'),
  ]);
  vi.mocked(repos.deleteDosingRule).mockReset().mockResolvedValue(undefined);
});

function renderPage(group = 'raptor') {
  return render(
    <MemoryRouter initialEntries={[`/admin/animals/group/${group}`]}>
      <Routes><Route path="/admin/animals/group/:group" element={<GroupPage />} /></Routes>
    </MemoryRouter>
  );
}

describe('GroupPage', () => {
  it("lists the group's rules and where a med is overridden", async () => {
    renderPage();
    expect(await screen.findByTestId('rule-melox__group-raptor__PO')).toBeInTheDocument();
    expect(screen.getByText('Overridden in: Red-tailed Hawk')).toBeInTheDocument();
  });

  it('lists species in the group', async () => {
    renderPage();
    expect(await screen.findByRole('link', { name: 'Barred Owl' })).toHaveAttribute('href', '/admin/animals/species/bo');
  });

  it('counts the species a group rule reaches when deleting it', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByTestId('rule-melox__group-raptor__PO');
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/1 species in Raptor uses this rule\./)).toBeInTheDocument();
  });

  it("warns when deleting the group's last rule for a med", async () => {
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByTestId('rule-baytril__group-raptor__PO');
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/2 species in Raptor use this rule and will have no rule for Baytril\./)).toBeInTheDocument();
  });

  it('offers meds without a group rule', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /add rule for praziquantel/i })).toBeInTheDocument();
  });

  it('explains an unknown group', async () => {
    renderPage('dragons');
    expect(await screen.findByText(/unknown group/i)).toBeInTheDocument();
  });

  it('shows a failed delete', async () => {
    vi.mocked(repos.deleteDosingRule).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderPage();
    const row = await screen.findByTestId('rule-baytril__group-raptor__PO');
    await user.click(within(row).getByRole('button', { name: /delete/i }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText('Delete failed: offline')).toBeInTheDocument();
  });
});
