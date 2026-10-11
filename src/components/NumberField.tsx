import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null;                       // null or NaN renders blank
  onValueChange: (v: number | null) => void;  // null = blank, NaN = not a plain decimal
};

/**
 * Numeric input that keeps the text the user typed, so "0.05" survives the
 * intermediate "0" and "0." states. Only parsed numbers go up to the parent.
 */
export function NumberField({ value, onValueChange, ...rest }: Props) {
  const [text, setText] = useState(() => toText(value));
  const [lastValue, setLastValue] = useState(value);
  // Adopt outside changes (e.g. editing a different record) without
  // clobbering in-progress typing that already parses to the same number.
  if (!sameNumber(value, lastValue)) {
    setLastValue(value);
    if (!sameNumber(value, parse(text))) setText(toText(value));
  }
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={e => {
        const next = e.target.value;
        const parsed = parse(next);
        setText(next);
        setLastValue(parsed);
        onValueChange(parsed);
      }}
    />
  );
}

const PLAIN_DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

function parse(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  return PLAIN_DECIMAL.test(t) ? Number(t) : NaN;
}

function toText(v: number | null): string {
  return v === null || !Number.isFinite(v) ? '' : String(v);
}

function sameNumber(a: number | null, b: number | null): boolean {
  const blankA = a === null || Number.isNaN(a);
  const blankB = b === null || Number.isNaN(b);
  return blankA || blankB ? blankA === blankB : a === b;
}
