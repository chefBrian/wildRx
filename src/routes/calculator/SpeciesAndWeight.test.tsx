import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SpeciesAndWeight } from './SpeciesAndWeight';

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn().mockResolvedValue([
    { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightGrams: { min: 700, max: 1500 } },
  ]),
  listMedications: vi.fn().mockResolvedValue([
    { id: 'm1', name: 'Meloxicam', genericName: 'Meloxicam', concentrations: [] },
  ]),
}));

describe('SpeciesAndWeight', () => {
  it('shows species and accepts weight input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/calc/m1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Red-tailed Hawk'));
    await user.click(screen.getByText('Red-tailed Hawk'));
    const weight = await screen.findByLabelText(/weight/i);
    await user.type(weight, '1000');
    expect((weight as HTMLInputElement).value).toBe('1000');
  });
});
