import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([]),
  listSpecies: vi.fn().mockResolvedValue([]),
  listDosingRulesForMed: vi.fn().mockResolvedValue([]),
}));

describe('App', () => {
  it('renders the calculator home at /', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('Search medications…')).toBeInTheDocument();
  });
});
