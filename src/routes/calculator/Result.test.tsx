import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { Result } from './Result';

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn().mockResolvedValue([
    { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightGrams: { min: 700, max: 1500 } },
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
      <MemoryRouter initialEntries={['/calc/m1/s1/1000']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/0\.2/)).toBeInTheDocument());
    expect(screen.getByText(/PO/i)).toBeInTheDocument();
    expect(screen.getByText(/q24h/i)).toBeInTheDocument();
  });

  it('shows no-rule message when none match', async () => {
    const { listDosingRulesForMed } = await import('../../firebase/repos');
    (listDosingRulesForMed as any).mockResolvedValueOnce([]);
    render(
      <MemoryRouter initialEntries={['/calc/m1/s1/1000']}>
        <Routes><Route path="/calc/:medId/:speciesId/:weight" element={<Result />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText(/no dosing rule/i)).toBeInTheDocument());
  });
});
