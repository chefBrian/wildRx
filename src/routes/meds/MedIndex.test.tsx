import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedIndex } from './MedIndex';
import * as repos from '../../firebase/repos';

vi.mock('../../firebase/repos', () => ({ listMedications: vi.fn() }));

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([
    { id: 'prazi', name: 'Praziquantel', doseUnit: 'mg', concentrations: [] },
    { id: 'melox', name: 'Meloxicam', genericName: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
    { id: 'pepto', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [], productDescription: 'Original' },
  ]);
});

function renderAt(url = '/meds') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/meds" element={<MedIndex />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MedIndex', () => {
  it('lists every medication by name, linking to its fact sheet', async () => {
    renderAt();
    const links = await screen.findAllByRole('link', { name: /meloxicam|pepto|praziquantel/i });
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/meds/melox', '/meds/pepto', '/meds/prazi']);
  });

  it('filters by name', async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByRole('link', { name: /meloxicam/i });
    await user.type(screen.getByLabelText(/filter medications/i), 'prazi');
    expect(screen.queryByRole('link', { name: /meloxicam/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /praziquantel/i })).toBeInTheDocument();
  });

  it('goes back home when opened directly', async () => {
    renderAt();
    expect(await screen.findByRole('link', { name: /back/i })).toHaveAttribute('href', '/');
  });

  it('shows an error with retry', async () => {
    vi.mocked(repos.listMedications).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderAt();
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: /meloxicam/i })).toBeInTheDocument();
  });
});
