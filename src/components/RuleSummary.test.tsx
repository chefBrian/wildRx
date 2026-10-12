import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RuleSummary } from './RuleSummary';
import type { DosingRule } from '../domain/types';

const rule: DosingRule = {
  id: 'melox__group-raptor__PO', medicationId: 'melox', target: { type: 'group', value: 'raptor' },
  dosePerKg: { min: 0.1, typical: 0.2, max: 0.5 }, route: 'PO', frequency: 'q24h',
  durationDays: { min: 5, max: 7 }, maxSingleDose: 2, contraindications: ['Renal disease', 'Dehydration'],
  notes: 'Give with food.', updatedAt: 0, updatedBy: '',
};

describe('RuleSummary', () => {
  it('shows the dose, route, frequency, duration, cap and flags', () => {
    render(<RuleSummary rule={rule} unit="mg" sourceLabel="Raptor" />);
    expect(screen.getByText('0.1–0.5 mg/kg (typ 0.2)')).toBeInTheDocument();
    expect(screen.getByText('PO')).toBeInTheDocument();
    expect(screen.getByText('By mouth')).toBeInTheDocument();
    expect(screen.getByText('q24h (Once a day)')).toBeInTheDocument();
    expect(screen.getByText('· 5 to 7 days')).toBeInTheDocument();
    expect(screen.getByText('· max 2 mg')).toBeInTheDocument();
    expect(screen.getByText('· 2 contraindications')).toBeInTheDocument();
    expect(screen.getByText('· notes')).toBeInTheDocument();
    expect(screen.getByText('Raptor')).toBeInTheDocument();
  });

  it('dims a hidden rule and renders actions', () => {
    render(<RuleSummary rule={rule} unit="mg" sourceLabel="Raptor" dimmed><button type="button">Edit</button></RuleSummary>);
    expect(screen.getByTestId('rule-melox__group-raptor__PO')).toHaveClass('opacity-60');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('shows full contraindications and notes in detail mode', () => {
    render(<RuleSummary rule={rule} unit="mg" sourceLabel="Raptor" detail />);
    expect(screen.getByText('Renal disease')).toBeInTheDocument();
    expect(screen.getByText('Dehydration')).toBeInTheDocument();
    expect(screen.getByText('Give with food.')).toBeInTheDocument();
    expect(screen.queryByText('· 2 contraindications')).not.toBeInTheDocument();
    expect(screen.queryByText('· notes')).not.toBeInTheDocument();
  });
});
