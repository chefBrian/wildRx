import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

vi.mock('./firebase/repos', () => ({
  listMedications: vi.fn().mockResolvedValue([]),
  listSpecies: vi.fn().mockResolvedValue([]),
  listAllDosingRules: vi.fn().mockResolvedValue([]),
}));

describe('App', () => {
  it('starts with the patient screen at /', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('Search species…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose medication/i })).toBeInTheDocument();
  });
});
