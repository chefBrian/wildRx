import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([{ id: 'm1', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] }]),
  listSpecies: vi.fn().mockResolvedValue([]),
  listAllDosingRules: vi.fn().mockResolvedValue([]),
  listDosingRulesForMed: vi.fn().mockResolvedValue([]),
}));

describe('App', () => {
  it('starts with the patient screen at /', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByPlaceholderText('Search species…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose medication/i })).toBeInTheDocument();
  });

  it('shows the fact sheet at /meds/m1', async () => {
    window.history.pushState({}, '', '/meds/m1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Meloxicam' })).toBeInTheDocument();
  });

  it('shows the medication index at /meds', async () => {
    window.history.pushState({}, '', '/meds');
    render(<App />);
    expect(await screen.findByLabelText(/filter medications/i)).toBeInTheDocument();
  });

  it('sends an unknown nested path under /meds to the index', async () => {
    window.history.pushState({}, '', '/meds/x/extra');
    render(<App />);
    expect(await screen.findByLabelText(/filter medications/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/meds');
  });
});
