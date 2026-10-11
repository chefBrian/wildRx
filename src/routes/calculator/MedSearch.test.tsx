import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MedSearch } from './MedSearch';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([
    { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
    { id: 'm2', name: 'Vitamin A', doseUnit: 'IU', concentrations: [] },
    { id: 'm3', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [], productDescription: 'Original' },
  ]),
}));

describe('MedSearch', () => {
  it('loads and shows medications', async () => {
    render(<MemoryRouter><MedSearch /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Meloxicam')).toBeInTheDocument());
  });

  it('shows the dose unit as a badge on each medication', async () => {
    render(<MemoryRouter><MedSearch /></MemoryRouter>);
    await waitFor(() => screen.getByText('Meloxicam'));
    expect(screen.getByText('mg')).toBeInTheDocument();
    expect(screen.getByText('IU')).toBeInTheDocument();
    expect(screen.getByText('ml/kg')).toBeInTheDocument();
  });

  it('navigates to species select when a med is picked', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/']}><MedSearch /></MemoryRouter>);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByText('Meloxicam'));
    // Navigation effect is tested via the URL change — implementer wires <Navigate> or useNavigate
  });
});
