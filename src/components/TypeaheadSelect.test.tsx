import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TypeaheadSelect } from './TypeaheadSelect';

const options = [
  { id: 'a', label: 'Amoxicillin', keywords: ['amoxicillin'] },
  { id: 'b', label: 'Buprenorphine', keywords: ['buprenorphine'] },
  { id: 'c', label: 'Meloxicam', keywords: ['meloxicam', 'metacam'] },
];

describe('TypeaheadSelect', () => {
  it('filters options by typed query', async () => {
    const user = userEvent.setup();
    render(<TypeaheadSelect options={options} onSelect={() => {}} placeholder="Search" />);
    await user.type(screen.getByPlaceholderText('Search'), 'melo');
    expect(screen.getByText('Meloxicam')).toBeInTheDocument();
    expect(screen.queryByText('Amoxicillin')).not.toBeInTheDocument();
  });

  it('matches keyword aliases', async () => {
    const user = userEvent.setup();
    render(<TypeaheadSelect options={options} onSelect={() => {}} placeholder="Search" />);
    await user.type(screen.getByPlaceholderText('Search'), 'metacam');
    expect(screen.getByText('Meloxicam')).toBeInTheDocument();
  });

  it('calls onSelect with option id when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TypeaheadSelect options={options} onSelect={onSelect} placeholder="Search" />);
    await user.type(screen.getByPlaceholderText('Search'), 'melo');
    await user.click(screen.getByText('Meloxicam'));
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('supports keyboard navigation (ArrowDown + Enter)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TypeaheadSelect options={options} onSelect={onSelect} placeholder="Search" />);
    const input = screen.getByPlaceholderText('Search');
    await user.type(input, 'a');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalled();
  });
});
