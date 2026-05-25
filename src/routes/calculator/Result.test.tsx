import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { Result } from './Result';

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn().mockResolvedValue([
    { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } },
  ]),
  listMedications: vi.fn().mockResolvedValue([
    { id: 'm1', name: 'Meloxicam', concentrations: [{ label: '1.5 mg/ml', mgPerMl: 1.5 }] },
  ]),
  listDosingRulesForMed: vi.fn().mockResolvedValue([
    { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
      mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
      durationDays: null, maxSingleDoseMg: null, contraindications: [], notes: '',
      updatedAt: 0, updatedBy: '' },
  ]),
}));

describe('Result', () => {
  it('shows calculated mg dose for a 1kg raptor', async () => {
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      // Dose hero shows the typical dose for 1 kg @ 0.2 mg/kg = 0.200 mg.
      expect(screen.getAllByText(/0\.2/).length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/PO/i)).toBeInTheDocument();
    expect(screen.getByText(/q24h/i)).toBeInTheDocument();
    // Math line is shown so volunteers can sanity-check the readout.
    expect(screen.getByText(/mg\/kg/)).toBeInTheDocument();
    // Disclaimer is always shown on successful results.
    expect(screen.getByText(/cross-check with the attending veterinarian/i)).toBeInTheDocument();
  });

  it('shows no-rule message when none match', async () => {
    const { listDosingRulesForMed } = await import('../../firebase/repos');
    (listDosingRulesForMed as any).mockResolvedValueOnce([]);
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/no dosing rule/i)).toBeInTheDocument());
  });

  it('uses the concentration from ?conc URL param', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', concentrations: [
        { label: '1.5 mg/ml first', mgPerMl: 1.5 },
        { label: '5 mg/ml second', mgPerMl: 5 },
      ] },
    ]);
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1?conc=1']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    // Selected concentration label should appear in the volume section caption.
    await waitFor(() => expect(screen.getByText(/5 mg\/ml second/)).toBeInTheDocument());
    // The dropdown should NOT exist on the result screen anymore.
    expect(screen.queryByLabelText(/concentration/i)).not.toBeInTheDocument();
  });

  it('renders notes as a callout block (not a bottom-of-page section)', async () => {
    const { listDosingRulesForMed } = await import('../../firebase/repos');
    (listDosingRulesForMed as any).mockResolvedValueOnce([
      { id: 'r1', medicationId: 'm1', target: { type: 'group', value: 'raptor' },
        mgPerKg: { min: 0.1, max: 0.5, typical: 0.2 }, route: 'PO', frequency: 'q24h',
        durationDays: null, maxSingleDoseMg: null, contraindications: [],
        notes: 'Mix into a small piece of fish.',
        updatedAt: 0, updatedBy: '' },
    ]);
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/mix into a small piece of fish/i)).toBeInTheDocument());
    // The notes block should carry a "Notes" label rendered in the callout header style.
    expect(screen.getByText(/^Notes$/)).toBeInTheDocument();
  });

  it('shows Dose as a column in the stat row with a range sublabel', async () => {
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText(/PO/i));
    // Dose column header
    expect(screen.getByText(/^Dose$/)).toBeInTheDocument();
    // Range sublabel under the Dose column. With mgPerKg 0.1-0.5, 1kg weight => range 0.100–0.500 mg.
    // (formatNumber renders 3 decimals for values >= 0.1 and < 1.)
    expect(screen.getByText(/range\s+0\.100\s*[–-]\s*0\.500\s+mg/i)).toBeInTheDocument();
  });

  it('promotes dose to hero when the med has zero concentrations', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', concentrations: [] },
    ]);
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText(/PO/i));
    // When there's no volume to feature, the Dose hero takes its place.
    const doseHero = screen.getByLabelText('Dose');
    expect(doseHero).toBeInTheDocument();
    // Volume section should not appear.
    expect(screen.queryByLabelText('Volume')).not.toBeInTheDocument();
  });
});
