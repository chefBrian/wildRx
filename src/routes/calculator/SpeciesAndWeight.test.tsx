import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SpeciesAndWeight } from './SpeciesAndWeight';

function UrlCapture({ onUrl }: { onUrl: (u: string) => void }) {
  const loc = useLocation();
  React.useEffect(() => {
    onUrl(loc.pathname + loc.search);
  }, [loc, onUrl]);
  return <div data-testid="landed" />;
}

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn().mockResolvedValue([
    { id: 's1', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } },
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
    await user.type(weight, '1');
    expect((weight as HTMLInputElement).value).toBe('1');
  });

  it('shows concentration picker when med has more than one concentration', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', concentrations: [
        { label: '1.5 mg/ml oral', mgPerMl: 1.5 },
        { label: '5 mg/ml injectable', mgPerMl: 5 },
      ] },
    ]);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/calc/m1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Red-tailed Hawk'));
    await user.click(screen.getByText('Red-tailed Hawk'));
    expect(await screen.findByLabelText(/concentration/i)).toBeInTheDocument();
  });

  it('writes ?conc=N into the navigation URL when med has multiple concentrations', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', concentrations: [
        { label: 'a', mgPerMl: 1 },
        { label: 'b', mgPerMl: 2 },
      ] },
    ]);
    const user = userEvent.setup();
    let landed = '';
    render(
      <MemoryRouter initialEntries={['/calc/m1']}>
        <Routes>
          <Route path="/calc/:medId" element={<SpeciesAndWeight />} />
          <Route path="/calc/:medId/:speciesId/:weight" element={
            <UrlCapture onUrl={u => { landed = u; }} />
          } />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Red-tailed Hawk'));
    await user.click(screen.getByText('Red-tailed Hawk'));
    const conc = await screen.findByLabelText(/concentration/i);
    await user.selectOptions(conc, '1');
    const weight = await screen.findByLabelText(/weight/i);
    await user.type(weight, '1');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    await waitFor(() => expect(landed).toContain('?conc=1'));
  });

  it('skips concentration picker when med has one concentration', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', concentrations: [{ label: 'only', mgPerMl: 1 }] },
    ]);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/calc/m1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Red-tailed Hawk'));
    await user.click(screen.getByText('Red-tailed Hawk'));
    expect(screen.queryByLabelText(/concentration/i)).not.toBeInTheDocument();
  });
});
