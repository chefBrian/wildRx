import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnimalsIndex } from './AnimalsIndex';
import * as repos from '../../../firebase/repos';
import type { Species } from '../../../domain/types';

vi.mock('../../../firebase/repos', () => ({
  listMedications: vi.fn(), listSpecies: vi.fn(), listAllDosingRules: vi.fn(), upsertSpecies: vi.fn(),
}));

const sp = (id: string, commonName: string, group: Species['group']): Species => ({
  id, commonName, scientificName: `${commonName} sci`, group, typicalWeightKg: { min: 1, max: 2 },
});

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([
    sp('rth', 'Red-tailed Hawk', 'raptor'), sp('bo', 'Barred Owl', 'raptor'), sp('robin', 'American Robin', 'songbird'),
  ]);
  vi.mocked(repos.upsertSpecies).mockReset().mockResolvedValue(undefined);
});

function renderIndex() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AnimalsIndex />} />
        <Route path="/admin/animals/species/:speciesId" element={<div>SPECIES PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AnimalsIndex', () => {
  it('lists groups with their species, linking to each page', async () => {
    renderIndex();
    expect(await screen.findByRole('link', { name: 'Raptor' })).toHaveAttribute('href', '/admin/animals/group/raptor');
    expect(screen.getByRole('link', { name: /red-tailed hawk/i })).toHaveAttribute('href', '/admin/animals/species/rth');
    expect(screen.getByRole('link', { name: 'Amphibian' })).toBeInTheDocument();
  });

  it('filters by species name or group', async () => {
    const user = userEvent.setup();
    renderIndex();
    await screen.findByRole('link', { name: /red-tailed hawk/i });
    await user.type(screen.getByLabelText(/filter animals/i), 'owl');
    expect(screen.getByRole('link', { name: /barred owl/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /red-tailed hawk/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Songbird' })).not.toBeInTheDocument();
  });

  it('opens the new species page after adding one', async () => {
    const user = userEvent.setup();
    renderIndex();
    await user.click(await screen.findByRole('button', { name: /add species/i }));
    await user.type(screen.getByLabelText('Common name'), 'Wood Stork');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText('SPECIES PAGE')).toBeInTheDocument();
  });
});
