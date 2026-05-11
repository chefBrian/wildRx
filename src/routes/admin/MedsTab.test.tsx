import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MedsTab } from './MedsTab';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([{ id: 'm1', name: 'Meloxicam', concentrations: [] }]),
  upsertMedication: vi.fn().mockResolvedValue(undefined),
  deleteMedication: vi.fn().mockResolvedValue(undefined),
}));

describe('MedsTab', () => {
  it('lists meds and adds a new one', async () => {
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByText(/add medication/i));
    await user.type(screen.getByLabelText(/name/i), 'Amoxicillin');
    await user.click(screen.getByRole('button', { name: /save/i }));
    const { upsertMedication } = await import('../../firebase/repos');
    expect(upsertMedication).toHaveBeenCalled();
  });
});
