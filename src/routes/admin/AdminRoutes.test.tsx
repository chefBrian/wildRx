import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AdminRoutes } from './AdminApp';

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../../firebase/auth', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn(), signInWithEmailAndPassword: vi.fn() }));
vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([]),
  listSpecies: vi.fn().mockResolvedValue([]),
  listAllDosingRules: vi.fn().mockResolvedValue([]),
  listDosingRulesForMed: vi.fn().mockResolvedValue([]),
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/admin/*" element={<AdminRoutes />} /></Routes>
    </MemoryRouter>
  );
}

describe('admin routes', () => {
  it('opens on the Animals tab', async () => {
    renderAt('/admin');
    expect(await screen.findByLabelText(/filter animals/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Animals' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/admin/rules', '/admin/species', '/admin/whatever'])('sends %s to the Animals tab', async url => {
    renderAt(url);
    expect(await screen.findByLabelText(/filter animals/i)).toBeInTheDocument();
  });

  it('keeps the Animals tab active on group and species pages', async () => {
    renderAt('/admin/animals/group/raptor');
    expect(await screen.findByRole('link', { name: 'Animals' })).toHaveAttribute('aria-current', 'page');
  });

  it('serves the Meds tab at /admin/meds', async () => {
    renderAt('/admin/meds');
    expect(await screen.findByRole('button', { name: /add medication/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Meds' })).toHaveAttribute('aria-current', 'page');
  });
});
