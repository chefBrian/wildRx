import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FactSheet } from './FactSheet';
import { MedIndex } from './MedIndex';
import * as repos from '../../firebase/repos';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn(), listSpecies: vi.fn(), listDosingRulesForMed: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([
    { id: 'x', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
  ]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listDosingRulesForMed).mockReset().mockResolvedValue([]);
});

describe('BackLink', () => {
  it('does not loop between the fact sheet and the index after a direct visit', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/meds/x']}>
        <Routes>
          <Route path="/meds/:medId" element={<FactSheet />} />
          <Route path="/meds" element={<MedIndex />} />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>
    );
    await user.click(await screen.findByRole('link', { name: /back/i }));
    expect(await screen.findByLabelText(/filter medications/i)).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: /back/i }));
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });
});
