// Canonical dosing-frequency tokens shown to admins. Adding new tokens here
// also wires them into plain-English rendering on the Result screen.

export interface FrequencyOption {
  token: string;
  plain: string;
}

export const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { token: 'once', plain: 'Once (single dose)' },
  { token: 'q24h', plain: 'Once a day' },
  { token: 'q12h', plain: 'Twice a day' },
  { token: 'q8h',  plain: '3 times a day' },
  { token: 'q6h',  plain: '4 times a day' },
  { token: 'q48h', plain: 'Every other day' },
  { token: 'prn',  plain: 'As needed' },
];

const TOKEN_SET = new Set(FREQUENCY_OPTIONS.map(o => o.token));

export function isCanonicalFrequency(token: string): boolean {
  return TOKEN_SET.has(token.trim().toLowerCase());
}

export function plainFrequency(freq: string): string {
  const f = freq.trim().toLowerCase();
  const hit = FREQUENCY_OPTIONS.find(o => o.token === f);
  if (hit) return hit.plain;
  // Legacy synonyms
  if (f === 'sid') return 'Once a day';
  if (f === 'bid') return 'Twice a day';
  if (f === 'tid') return '3 times a day';
  if (f === 'qid') return '4 times a day';
  if (f === 'eod') return 'Every other day';
  // Range like q6-12h
  const range = f.match(/^q(\d+)\s*-\s*(\d+)\s*h$/);
  if (range) return `Every ${range[1]}-${range[2]} hours`;
  // Single qNh
  const single = f.match(/^q(\d+)\s*h$/);
  if (single) {
    const n = Number(single[1]);
    if (n === 1) return 'Every hour';
    return `Every ${n} hours`;
  }
  return freq;
}
