import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedList } from './MedList';
import { clearPatientSnapshot } from './patientSnapshot';
import { SchemaMismatchError } from '../../firebase/schemaGuard';
import * as repos from '../../firebase/repos';
import type { DosingRule, Medication, Species } from '../../domain/types';

vi.mock('../../firebase/repos', () => ({
  listSpecies: vi.fn(),
  listMedications: vi.fn(),
  listAllDosingRules: vi.fn(),
}));

const hawk: Species = { id: 'rth', commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', group: 'raptor', typicalWeightKg: { min: 0.7, max: 1.5 } };
const oddBird: Species = { id: 'odd id', commonName: 'Odd Bird', scientificName: 'Avis rara', group: 'raptor', typicalWeightKg: { min: 1, max: 2 } };
const meloxicam: Medication = { id: 'melox', name: 'Meloxicam', doseUnit: 'mg', concentrations: [{ id: 'c1', value: 1.5, form: 'oral' }] };
const ivermectin: Medication = { id: 'iver', name: 'Ivermectin', doseUnit: 'mg', concentrations: [
  { id: 'inj10', value: 10, form: 'injectable' },
  { id: 'inj1', value: 1, form: 'injectable', note: '1:10 dilution' },
] };
const pepto: Medication = { id: 'pepto', name: 'Pepto-Bismol', doseUnit: 'ml', concentrations: [], productDescription: 'Original' };
const prazi: Medication = { id: 'prazi', name: 'Praziquantel', doseUnit: 'mg', concentrations: [] };
const groupRule = (medicationId: string): DosingRule => ({
  id: `${medicationId}__group-raptor__PO`, medicationId, target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, route: 'PO', frequency: 'q24h', durationDays: null,
  maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: '',
});

beforeEach(() => {
  clearPatientSnapshot();
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([hawk, oddBird]);
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([meloxicam, ivermectin, pepto, prazi]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue([groupRule('melox'), groupRule('iver'), groupRule('pepto')]);
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
        <Route path="/dose/:speciesId/:weight" element={<MedList />} />
        <Route path="/dose/:speciesId/:weight/:medId" element={<UrlCapture onUrl={onUrl} />} />
        <Route path="/" element={<div>PATIENT</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MedList', () => {
  it('lists meds with a rule and collapses the rest as plain text', async () => {
    renderAt('/dose/rth/1.2');
    expect(await screen.findByRole('button', { name: /meloxicam/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ivermectin/i })).toBeInTheDocument();
    expect(screen.getByText('No rule for Red-tailed Hawk (1)')).toBeInTheDocument();
    expect(screen.getByText('Praziquantel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /praziquantel/i })).not.toBeInTheDocument();
  });

  it('shows the patient in the header chip', async () => {
    renderAt('/dose/rth/1.2');
    const chip = await screen.findByRole('link', { name: /red-tailed hawk/i });
    expect(chip).toHaveAttribute('href', '/?species=rth&weight=1.2');
  });

  it('goes straight to the result for a single-bottle med', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/dose/rth/1.2', u => { landed = u; });
    await user.click(await screen.findByRole('button', { name: /meloxicam/i }));
    await waitFor(() => expect(landed).toBe('/dose/rth/1.2/melox'));
  });

  it('goes straight to the result for an ml med', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/dose/rth/1.2', u => { landed = u; });
    await user.click(await screen.findByRole('button', { name: /pepto-bismol/i }));
    await waitFor(() => expect(landed).toBe('/dose/rth/1.2/pepto'));
  });

  it('carries ?route into the result URL when a bottle is picked', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/dose/rth/1.2?open=iver&route=IM', u => { landed = u; });
    await user.click(await screen.findByRole('button', { name: '1 mg/ml · injectable · 1:10 dilution' }));
    await waitFor(() => expect(landed).toBe('/dose/rth/1.2/iver?conc=inj1&route=IM'));
  });

  it('expands a multi-bottle med with nothing chosen, then goes to the result with ?conc', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/dose/rth/1.2', u => { landed = u; });
    await user.click(await screen.findByRole('button', { name: /ivermectin/i }));
    expect(screen.getByText('Which bottle?')).toBeInTheDocument();
    expect(landed).toBe('');
    await user.click(screen.getByRole('button', { name: '1 mg/ml · injectable · 1:10 dilution' }));
    await waitFor(() => expect(landed).toBe('/dose/rth/1.2/iver?conc=inj1'));
  });

  it('restores the expanded med from ?open and explains a ?pick redirect', async () => {
    renderAt('/dose/rth/1.2?open=iver&pick=1');
    expect(await screen.findByText('Which bottle?')).toBeInTheDocument();
    expect(screen.getByText(/the link didn't say which bottle/i)).toBeInTheDocument();
  });

  it('ignores ?open for an unknown or single-bottle med', async () => {
    renderAt('/dose/rth/1.2?open=melox');
    await screen.findByRole('button', { name: /meloxicam/i });
    expect(screen.queryByText('Which bottle?')).not.toBeInTheDocument();
  });

  it('filters both sections', async () => {
    const user = userEvent.setup();
    renderAt('/dose/rth/1.2');
    await screen.findByRole('button', { name: /meloxicam/i });
    await user.type(screen.getByLabelText(/filter medications/i), 'prazi');
    expect(screen.queryByRole('button', { name: /meloxicam/i })).not.toBeInTheDocument();
    expect(screen.getByText('Praziquantel')).toBeInTheDocument();
  });

  it('says so when the species has no ruled meds at all', async () => {
    vi.mocked(repos.listAllDosingRules).mockResolvedValue([]);
    renderAt('/dose/rth/1.2');
    expect(await screen.findByText(/no medication has a dosing rule for red-tailed hawk/i)).toBeInTheDocument();
  });

  it('encodes species ids in result links', async () => {
    const user = userEvent.setup();
    let landed = '';
    renderAt('/dose/odd%20id/2', u => { landed = u; });
    await user.click(await screen.findByRole('button', { name: /meloxicam/i }));
    await waitFor(() => expect(landed).toBe('/dose/odd%20id/2/melox'));
  });

  it('explains an unknown species', async () => {
    renderAt('/dose/nope/1.2');
    expect(await screen.findByText(/unknown animal/i)).toBeInTheDocument();
  });

  it.each(['abc', '0x10', '0'])('treats weight %j as missing', async w => {
    renderAt(`/dose/rth/${w}`);
    expect(await screen.findByText(/weight missing/i)).toBeInTheDocument();
  });

  it('shows the update notice for old-shape rules', async () => {
    vi.mocked(repos.listAllDosingRules).mockRejectedValue(new SchemaMismatchError('dosingRules', 'r1'));
    renderAt('/dose/rth/1.2');
    expect(await screen.findByText(/data update in progress/i)).toBeInTheDocument();
  });

  it('shows an error with retry instead of a stuck skeleton', async () => {
    vi.mocked(repos.listAllDosingRules).mockRejectedValueOnce(new Error('offline'));
    const user = userEvent.setup();
    renderAt('/dose/rth/1.2');
    await user.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('button', { name: /meloxicam/i })).toBeInTheDocument();
  });

  it('disables a bottle that none of the routes in effect can use', async () => {
    vi.mocked(repos.listMedications).mockResolvedValue([
      { id: 'iver', name: 'Ivermectin', doseUnit: 'mg', concentrations: [
        { id: 'inj10', value: 10, form: 'injectable', routes: ['IM'] },
        { id: 'inj1', value: 1, form: 'injectable', note: '1:10 dilution' },
      ] },
    ]);
    vi.mocked(repos.listAllDosingRules).mockResolvedValue([groupRule('iver')]); // PO
    const user = userEvent.setup();
    renderAt('/dose/rth/1.2');
    await user.click(await screen.findByRole('button', { name: /ivermectin/i }));
    expect(screen.queryByRole('button', { name: /10 mg\/ml/ })).not.toBeInTheDocument();
    expect(screen.getByText('10 mg/ml · injectable')).toBeInTheDocument();
    expect(screen.getByText('Not for PO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 mg/ml · injectable · 1:10 dilution' })).toBeInTheDocument();
  });

  it('says so when no bottle can be used for the routes in effect', async () => {
    vi.mocked(repos.listMedications).mockResolvedValue([
      { id: 'iver', name: 'Ivermectin', doseUnit: 'mg', concentrations: [
        { id: 'a', value: 10, form: 'injectable', routes: ['IM'] },
        { id: 'b', value: 1, form: 'injectable', routes: ['SC'] },
      ] },
    ]);
    vi.mocked(repos.listAllDosingRules).mockResolvedValue([groupRule('iver')]); // PO
    const user = userEvent.setup();
    renderAt('/dose/rth/1.2');
    await user.click(await screen.findByRole('button', { name: /ivermectin/i }));
    expect(screen.getByText('No bottle on file can be given by PO. Ask a vet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mg\/ml/ })).not.toBeInTheDocument();
  });

  it('keeps bottles selectable when they cover only some of the routes in effect', async () => {
    vi.mocked(repos.listMedications).mockResolvedValue([
      { id: 'iver', name: 'Ivermectin', doseUnit: 'mg', concentrations: [
        { id: 'im', value: 10, form: 'injectable', routes: ['IM'] },
        { id: 'po', value: 1, form: 'oral', routes: ['PO'] },
        { id: 'sc', value: 5, form: 'injectable', routes: ['SC'] },
      ] },
    ]);
    vi.mocked(repos.listAllDosingRules).mockResolvedValue([groupRule('iver'), { ...groupRule('iver'), id: 'iver__group-raptor__IM', route: 'IM' }]);
    const user = userEvent.setup();
    renderAt('/dose/rth/1.2');
    await user.click(await screen.findByRole('button', { name: /ivermectin/i }));
    expect(screen.getByRole('button', { name: /10 mg\/ml/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^1 mg\/ml/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^5 mg\/ml/ })).not.toBeInTheDocument();
    expect(screen.getByText('Not for PO, IM')).toBeInTheDocument();
  });
});
