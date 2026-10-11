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
    { id: 'm1', name: 'Meloxicam', genericName: 'Meloxicam', doseUnit: 'mg', concentrations: [] },
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

  const twoConcs = [
    { id: 'oral', value: 1.5, form: 'oral', note: 'Metacam' },
    { id: 'inj', value: 5, form: 'injectable' },
  ];

  async function withTwoConcs() {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: twoConcs },
    ]);
  }

  it('shows concentration picker when med has more than one concentration', async () => {
    await withTwoConcs();
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

  it('shows generated concentration text in the picker', async () => {
    await withTwoConcs();
    render(
      <MemoryRouter initialEntries={['/calc/m1?species=s1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    await screen.findByLabelText(/concentration/i);
    expect(screen.getByRole('option', { name: '1.5 mg/ml · oral · Metacam' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '5 mg/ml · injectable' })).toBeInTheDocument();
  });

  it('starts with no concentration selected and Calculate disabled until one is picked', async () => {
    await withTwoConcs();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/calc/m1?species=s1&weight=1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    const conc = await screen.findByLabelText(/concentration/i) as HTMLSelectElement;
    expect(conc.value).toBe('');
    expect(screen.getByRole('button', { name: /calculate/i })).toBeDisabled();
    await user.selectOptions(conc, 'inj');
    expect(screen.getByRole('button', { name: /calculate/i })).toBeEnabled();
  });

  it('writes ?conc=<id> into the navigation URL', async () => {
    await withTwoConcs();
    const user = userEvent.setup();
    let landed = '';
    render(
      <MemoryRouter initialEntries={['/calc/m1']}>
        <Routes>
          <Route path="/calc/:medId" element={<SpeciesAndWeight />} />
          <Route path="/calc/:medId/:speciesId/:weight" element={<UrlCapture onUrl={u => { landed = u; }} />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByText('Red-tailed Hawk'));
    await user.click(screen.getByText('Red-tailed Hawk'));
    await user.selectOptions(await screen.findByLabelText(/concentration/i), 'inj');
    await user.type(await screen.findByLabelText(/weight/i), '1');
    await user.click(screen.getByRole('button', { name: /calculate/i }));
    await waitFor(() => expect(landed).toContain('?conc=inj'));
  });

  it('pre-selects the concentration from a valid ?conc id', async () => {
    await withTwoConcs();
    render(
      <MemoryRouter initialEntries={['/calc/m1?species=s1&conc=inj']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    const conc = await screen.findByLabelText(/concentration/i) as HTMLSelectElement;
    expect(conc.value).toBe('inj');
  });

  it('leaves nothing selected for an unknown ?conc', async () => {
    await withTwoConcs();
    render(
      <MemoryRouter initialEntries={['/calc/m1?species=s1&conc=1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    const conc = await screen.findByLabelText(/concentration/i) as HTMLSelectElement;
    expect(conc.value).toBe('');
  });

  it('explains why the user is back when redirected with ?pick=1', async () => {
    await withTwoConcs();
    render(
      <MemoryRouter initialEntries={['/calc/m1?species=s1&weight=1&pick=1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/pick the concentration you're using/i)).toBeInTheDocument();
  });

  it('skips the concentration picker when the med has one concentration', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [{ id: 'only', value: 1, form: 'oral' }] },
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

  it('shows the product instead of a picker for ml meds', async () => {
    const { listMedications } = await import('../../firebase/repos');
    (listMedications as any).mockResolvedValueOnce([
      { id: 'm1', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [],
        productDescription: 'Pepto-Bismol Original (17.5 mg/ml)' },
    ]);
    render(
      <MemoryRouter initialEntries={['/calc/m1?species=s1']}>
        <Routes><Route path="/calc/:medId" element={<SpeciesAndWeight />} /></Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Pepto-Bismol Original (17.5 mg/ml)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/concentration/i)).not.toBeInTheDocument();
  });
});
