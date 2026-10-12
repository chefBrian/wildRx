import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Result } from './Result';
import type { DosingRule } from '../../domain/types';
import { clearPatientSnapshot } from './patientSnapshot';

const baseRule: DosingRule = {
  id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
  durationDays: null, maxSingleDose: null, contraindications: [], notes: '',
  updatedAt: 0, updatedBy: '',
};

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn().mockResolvedValue([
    { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } },
  ]),
  listMedications: vi.fn().mockResolvedValue([
    { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [{ id: 'c1', value: 1.5, form: 'oral' }] },
  ]),
  listAllDosingRules: vi.fn(),
}));

beforeEach(async () => {
  clearPatientSnapshot();
  const { listAllDosingRules } = await import('../../firebase/repos');
  vi.mocked(listAllDosingRules).mockResolvedValue([baseRule]);
});

function MedListStub() {
  const loc = useLocation();
  return <div>MED LIST {loc.pathname}{loc.search}</div>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/dose/:speciesId/:weight/:medId" element={<Result />} />
        <Route path="/dose/:speciesId/:weight" element={<MedListStub />} />
        <Route path="/" element={<div>PATIENT</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Result', () => {
  it('links to the fact sheet for this medication', async () => {
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    expect(screen.getByRole('link', { name: /about meloxicam/i })).toHaveAttribute('href', '/meds/m1');
  });

  it('shows calculated mg dose for a 1kg raptor', async () => {
    renderAt('/dose/s1/1/m1');
    await waitFor(() => {
      expect(screen.getAllByText(/0\.2/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/PO/i)).toBeInTheDocument();
    expect(screen.getByText(/q24h/i)).toBeInTheDocument();
    expect(screen.getByText(/mg\/kg/)).toBeInTheDocument();
    expect(screen.getByText(/cross-check with the attending veterinarian/i)).toBeInTheDocument();
  });

  it('shows no-rule message when none match', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText(/no dosing rule/i)).toBeInTheDocument());
  });

  it('uses the concentration selected by ?conc id and shows generated text', async () => {
    const { listMedications } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'oral', value: 1.5, form: 'oral', note: 'Metacam' },
        { id: 'inj', value: 5, form: 'injectable' },
      ] },
    ]);
    renderAt('/dose/s1/1/m1?conc=inj');
    await waitFor(() => expect(screen.getByText('5 mg/ml · injectable')).toBeInTheDocument());
    expect(screen.queryByLabelText(/concentration/i)).not.toBeInTheDocument();
  });

  it('sends an old index-style ?conc back to the med list to pick', async () => {
    const { listMedications } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'oral', value: 1.5, form: 'oral' },
        { id: 'inj', value: 5, form: 'injectable' },
      ] },
    ]);
    renderAt('/dose/s1/1/m1?conc=1');
    await waitFor(() => expect(screen.getByText('MED LIST /dose/s1/1?open=m1&pick=1')).toBeInTheDocument());
  });

  it('renders notes as a callout block (not a bottom-of-page section)', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([
      { ...baseRule, notes: 'Mix into a small piece of fish.' },
    ]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText(/mix into a small piece of fish/i)).toBeInTheDocument());
    expect(screen.getByText(/^Notes$/)).toBeInTheDocument();
  });

  it('shows Dose as a column in the stat row with a range sublabel', async () => {
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    expect(screen.getByText(/^Dose$/)).toBeInTheDocument();
    expect(screen.getByText(/range\s+0\.1\s*[–-]\s*0\.5\s+mg/i)).toBeInTheDocument();
  });

  it('promotes dose to hero when the med has zero concentrations', async () => {
    const { listMedications } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
    ]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    const doseHero = screen.getByLabelText('Dose');
    expect(doseHero).toBeInTheDocument();
    expect(screen.queryByLabelText('Volume')).not.toBeInTheDocument();
  });

  it('shows IU units in the hero, stat row and math line', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Vitamin A', doseUnit: 'IU', concentrations: [{ id: 'c1', value: 50000, form: 'injectable' }] },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([
      { ...baseRule, dosePerKg: { min: 1000, typical: 2000, max: 2000 }, route: 'IM' },
    ]);
    renderAt('/dose/s1/1/m1');
    // 1 kg × 2000 IU/kg = 2000 IU ÷ 50,000 IU/ml = 0.04 ml
    await waitFor(() => expect(screen.getByText('2,000 IU')).toBeInTheDocument());
    expect(screen.getByText('50,000 IU/ml · injectable')).toBeInTheDocument();
    expect(screen.getAllByText(/IU\/kg/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Volume')).toHaveTextContent('0.04');
  });

  it('shows an ml med by volume with its product and rate', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [],
        productDescription: 'Pepto-Bismol Original (17.5 mg/ml)' },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([
      { ...baseRule, dosePerKg: { min: 1, typical: 1, max: 2 } },
    ]);
    renderAt('/dose/s1/0.5/m1');
    await waitFor(() => expect(screen.getByLabelText('Volume')).toHaveTextContent('0.5'));
    expect(screen.getByText('Pepto-Bismol Original (17.5 mg/ml)')).toBeInTheDocument();
    expect(screen.getByText('1 ml/kg')).toBeInTheDocument();
  });

  it('does not warn about an injectable on a PO rule', async () => {
    const { listMedications } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [{ id: 'c1', value: 5, form: 'injectable' }] },
    ]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    expect(screen.queryByText(/suitable for injection/)).not.toBeInTheDocument();
  });

  it('warns when the volume is below measurable', async () => {
    renderAt('/dose/s1/0.02/m1'); // 0.02 kg × 0.2 = 0.004 mg ÷ 1.5 = 0.0027 ml
    await waitFor(() => expect(screen.getByText(/Below measurable volume/i)).toBeInTheDocument());
  });

  it('shows the cap banner when only the top of the range is capped', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([{ ...baseRule, maxSingleDose: 0.3 }]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText('Top of range capped at 0.3 mg.')).toBeInTheDocument());
  });

  it('hides the range line when min equals max', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([
      { ...baseRule, dosePerKg: { min: 0.2, typical: 0.2, max: 0.2 } },
    ]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    expect(screen.queryByText(/range/i)).not.toBeInTheDocument();
  });

  it('shows the update notice for old-shape rules', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    const { SchemaMismatchError } = await import('../../firebase/schemaGuard');
    vi.mocked(listAllDosingRules).mockRejectedValueOnce(new SchemaMismatchError('dosingRules', 'r1'));
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText(/data update in progress/i)).toBeInTheDocument());
  });

  it('copies the volume range and warnings for an ml med', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [],
        productDescription: 'Pepto-Bismol Original (17.5 mg/ml)' },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([
      { ...baseRule, dosePerKg: { min: 1, typical: 1, max: 2 }, maxSingleDose: 0.8 },
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAt('/dose/s1/0.5/m1');
    await waitFor(() => screen.getByLabelText('Volume'));
    fireEvent.click(screen.getByRole('button', { name: /copy summary/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toMatch(/^Volume: 0\.5 ml {2}\(range 0\.5[–-]0\.8 ml\) @ /m);
    expect(text).toMatch(/^⚠ /m);
  });

  it('links back to the med list and the patient', async () => {
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/dose/s1/1');
    expect(screen.getByRole('link', { name: /red-tailed hawk/i })).toHaveAttribute('href', '/?species=s1&weight=1');
    expect(screen.getByRole('link', { name: /new patient/i })).toHaveAttribute('href', '/');
  });

  it('reopens the bottle choice when going back from a multi-bottle med', async () => {
    const { listMedications } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'oral', value: 1.5, form: 'oral' },
        { id: 'inj', value: 5, form: 'injectable' },
      ] },
    ]);
    renderAt('/dose/s1/1/m1?conc=inj');
    await waitFor(() => screen.getByText(/PO/i));
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute('href', '/dose/s1/1?open=m1');
  });

  it('goes to the med list for another med for this patient', async () => {
    renderAt('/dose/s1/1/m1');
    await waitFor(() => screen.getByText(/PO/i));
    fireEvent.click(screen.getByRole('button', { name: /another med for this patient/i }));
    await waitFor(() => expect(screen.getByText('MED LIST /dose/s1/1')).toBeInTheDocument());
  });

  it.each(['0x10', 'abc'])('treats weight %j as missing', async w => {
    renderAt(`/dose/s1/${w}/m1`);
    await waitFor(() => expect(screen.getByText(/weight missing/i)).toBeInTheDocument());
  });

  it('shows an error with retry instead of a stuck skeleton', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockRejectedValueOnce(new Error('offline'));
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText(/couldn't load the dosing data/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByText(/q24h/i)).toBeInTheDocument());
  });

  const twoRoutes = () => [baseRule, { ...baseRule, id: 'r2', route: 'IM' as const }];

  it('blocks a route the bottle is not set for and shows no dose number anywhere', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    // Oral bottle (no stored routes → PO only) on an IM rule with a cap that would otherwise warn.
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([{ ...baseRule, route: 'IM', maxSingleDose: 0.1 }]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText('Not for IM use')).toBeInTheDocument());
    expect(screen.getByText('1.5 mg/ml · oral is set for PO only.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Volume')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dose')).not.toBeInTheDocument();
    expect(screen.queryByText(/capped/i)).not.toBeInTheDocument();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/0\.1\s*mg\b/); // capped dose
    expect(text).not.toMatch(/\d\s*ml\b/);    // any volume
    expect(text).not.toContain('×');          // math line
    expect(screen.getByRole('button', { name: /copy summary/i })).toBeDisabled();
  });

  it('says no bottle on file can be given by the route when no other bottle allows it', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([{ ...baseRule, route: 'IM' }]);
    renderAt('/dose/s1/1/m1');
    await waitFor(() => expect(screen.getByText(/No bottle on file can be given by IM\. Ask a vet\./)).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /choose another bottle/i })).not.toBeInTheDocument();
  });

  it('links to another bottle when one allows the route', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'oral', value: 1.5, form: 'oral' },
        { id: 'inj', value: 5, form: 'injectable', routes: ['IM', 'SC'] },
      ] },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([{ ...baseRule, route: 'IM' }]);
    renderAt('/dose/s1/1/m1?conc=oral');
    await waitFor(() => expect(screen.getByText('Not for IM use')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /choose another bottle/i })).toHaveAttribute('href', '/dose/s1/1?open=m1&route=IM');
  });

  it('opens on the first route tab the bottle allows', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'oral', value: 1.5, form: 'oral' },
        { id: 'inj', value: 5, form: 'injectable', routes: ['IM'] },
      ] },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce(twoRoutes()); // PO first, then IM
    renderAt('/dose/s1/1/m1?conc=inj');
    await waitFor(() => expect(screen.getByRole('tab', { name: /IM/ })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByLabelText('Volume')).toBeInTheDocument();
  });

  it('opens on the ?route tab when the bottle allows it', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'inj', value: 5, form: 'injectable', routes: ['PO', 'IM'] },
        { id: 'oral', value: 1.5, form: 'oral' },
      ] },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce(twoRoutes()); // PO first, then IM
    renderAt('/dose/s1/1/m1?conc=inj&route=IM');
    await waitFor(() => expect(screen.getByRole('tab', { name: /IM/ })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByLabelText('Volume')).toBeInTheDocument();
  });

  it('ignores a ?route the bottle does not allow', async () => {
    const { listMedications, listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [
        { id: 'oral', value: 1.5, form: 'oral' },
        { id: 'other', value: 5, form: 'injectable', routes: ['PO'] },
      ] },
    ]);
    vi.mocked(listAllDosingRules).mockResolvedValueOnce(twoRoutes());
    renderAt('/dose/s1/1/m1?conc=oral&route=IM');
    await waitFor(() => expect(screen.getByRole('tab', { name: /PO/ })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.queryByText('Not for IM use')).not.toBeInTheDocument();
  });

  it('says the bottle has no routes set when it allows none', async () => {
    const { listMedications } = await import('../../firebase/repos');
    vi.mocked(listMedications).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [{ id: 'x', value: 1.5, form: 'other' }] },
    ]);
    renderAt('/dose/s1/1/m1?conc=x');
    await waitFor(() => expect(screen.getByText(/has no routes set\./)).toBeInTheDocument());
    expect(screen.queryByLabelText('Volume')).not.toBeInTheDocument();
  });

  it('suggests another route when this bottle allows one', async () => {
    const { listAllDosingRules } = await import('../../firebase/repos');
    vi.mocked(listAllDosingRules).mockResolvedValueOnce([{ ...baseRule, id: 'r2', route: 'IM' }, baseRule]);
    const user = userEvent.setup();
    renderAt('/dose/s1/1/m1');
    // Oral bottle: PO allowed, so it opens on the PO tab (index 1).
    await waitFor(() => expect(screen.getByRole('tab', { name: /PO/ })).toHaveAttribute('aria-selected', 'true'));
    await user.click(screen.getByRole('tab', { name: /IM/ }));
    expect(screen.getByText(/No bottle on file can be given by IM\. Ask a vet\. Or choose another route above\./)).toBeInTheDocument();
  });
});
