import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Patient } from './Patient';
import { clearPatientSnapshot, getPatientSnapshot } from './patientSnapshot';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import * as repos from '../../firebase/repos';

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn(),
  listMedications: vi.fn(),
  listAllDosingRules: vi.fn(),
}));

beforeEach(() => {
  clearPatientSnapshot();
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([
    { id: 'rth', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } },
    { id: 'odd id', commonName: 'Odd Bird', scientificName: 'Avis rara', group: 'other', typicalWeightKg: { min: 1, max: 2 } },
  ]);
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue([]);
});

function UrlCapture({ onUrl }: { onUrl: (u: string) => void }) {
  const loc = useLocation();
  React.useEffect(() => { onUrl(loc.pathname + loc.search); }, [loc, onUrl]);
  return <div>LANDED</div>;
}

function renderAt(url: string, onUrl: (u: string) => void = () => {}) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<Patient />} />
        <Route path="/dose/:speciesId/:weight" element={<UrlCapture onUrl={onUrl} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Patient', () => {
  it('pre-fills species and weight from the query', async () => {
    renderAt('/?species=rth&weight=1.2');
    expect(await screen.findByText('Red-tailed Hawk')).toBeInTheDocument();
    expect(screen.getByLabelText(/weight/i)).toHaveValue('1.2');
    expect(screen.getByRole('button', { name: /choose medication/i })).toBeEnabled();
  });

  it('keeps the button disabled until a species and a weight above 0 are given', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const button = screen.getByRole('button', { name: /choose medication/i });
    expect(button).toBeDisabled();
    await user.click(await screen.findByText('Red-tailed Hawk'));
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/weight/i), '0');
    expect(button).toBeDisabled();
    await user.clear(screen.getByLabelText(/weight/i));
    await user.type(screen.getByLabelText(/weight/i), '1.2');
    expect(button).toBeEnabled();
  });

  it('explains a weight it cannot read instead of guessing', async () => {
    const user = userEvent.setup();
    renderAt('/?species=rth');
    await screen.findByText('Red-tailed Hawk');
    expect(screen.queryByText(/enter weight in kg as a number/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/weight/i), '1,2');
    expect(screen.getByText('Enter weight in kg as a number, e.g. 1.2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose medication/i })).toBeDisabled();
  });

  it('navigates to the med list', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/?species=rth&weight=1.2', u => { landed = u; });
    await user.click(await screen.findByRole('button', { name: /choose medication/i }));
    await waitFor(() => expect(landed).toBe('/dose/rth/1.2'));
  });

  it('encodes species ids in the URL', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/?species=odd%20id&weight=2', u => { landed = u; });
    await screen.findByText('Odd Bird');
    await user.click(screen.getByRole('button', { name: /choose medication/i }));
    await waitFor(() => expect(landed).toBe('/dose/odd%20id/2'));
  });

  it('shows the species search for an unknown species id', async () => {
    renderAt('/?species=nope&weight=1');
    expect(await screen.findByPlaceholderText('Search species…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose medication/i })).toBeDisabled();
  });

  it('starts a new patient with fresh data, loading species once', async () => {
    await getPatientSnapshot();
    expect(repos.listMedications).toHaveBeenCalledTimes(1);
    renderAt('/');
    await screen.findByText('Red-tailed Hawk');
    expect(repos.listMedications).toHaveBeenCalledTimes(2);
    expect(repos.listSpecies).toHaveBeenCalledTimes(2); // once per snapshot, never separately
  });

  it('shows an error with retry when loading fails', async () => {
    vi.mocked(repos.listSpecies).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderAt('/');
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Red-tailed Hawk')).toBeInTheDocument();
  });

  it('shows the update notice for old-shape rules', async () => {
    vi.mocked(repos.listAllDosingRules).mockRejectedValueOnce(new SchemaMismatchError('dosingRules', 'r1'));
    renderAt('/');
    expect(await screen.findByText(/data update in progress/i)).toBeInTheDocument();
  });
});
