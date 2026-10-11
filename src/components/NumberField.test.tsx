import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NumberField } from './NumberField';

interface HarnessProps {
  initial?: number | null;
  onChange?: (v: number | null) => void;
}

function Harness({ initial = null, onChange }: HarnessProps) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <NumberField aria-label="n" value={v} onValueChange={x => { setV(x); onChange?.(x); }} />
      <button type="button" onClick={() => setV(42)}>set 42</button>
    </>
  );
}

describe('NumberField', () => {
  it.each(['0.05', '0.01', '0.3', '22.7', '50000'])('keeps %s exactly as typed and reports it', async typed => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText('n'), typed);
    expect((screen.getByLabelText('n') as HTMLInputElement).value).toBe(typed);
    expect(onChange).toHaveBeenLastCalledWith(Number(typed));
  });

  it('reports null when cleared', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={5} onChange={onChange} />);
    await user.clear(screen.getByLabelText('n'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('reports NaN for text that is not a plain decimal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.type(screen.getByLabelText('n'), '1e3');
    expect(onChange).toHaveBeenLastCalledWith(NaN);
  });

  it('renders NaN and null as blank', () => {
    render(<NumberField aria-label="n" value={NaN} onValueChange={() => {}} />);
    expect((screen.getByLabelText('n') as HTMLInputElement).value).toBe('');
  });

  it('adopts a new value from the parent', async () => {
    const user = userEvent.setup();
    render(<Harness initial={1} />);
    await user.click(screen.getByText('set 42'));
    expect((screen.getByLabelText('n') as HTMLInputElement).value).toBe('42');
  });
});
