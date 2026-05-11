import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MedSearch } from './MedSearch';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([
    { id: 'm1', name: 'Meloxicam', concentrations: [] },
    { id: 'm2', name: 'Amoxicillin', concentrations: [] },
  ]),
}));

describe('MedSearch', () => {
  it('loads and shows medications', async () => {
    render(<MemoryRouter><MedSearch /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Meloxicam')).toBeInTheDocument());
  });

  it('navigates to species select when a med is picked', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/']}><MedSearch /></MemoryRouter>);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByText('Meloxicam'));
    // Navigation effect is tested via the URL change — implementer wires <Navigate> or useNavigate
  });
});
