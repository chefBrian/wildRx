import { describe, it, expect } from 'vitest';
import { parseWeightParam } from './weight';

describe('parseWeightParam', () => {
  it.each([
    ['1', 1], ['1.2', 1.2], ['0.05', 0.05], ['.5', 0.5], ['12.', 12], [' 2 ', 2],
  ])('%j → %s', (s, n) => {
    expect(parseWeightParam(s)).toBe(n);
  });

  // Number('0x10') is 16 and Number('1e3') is 1000: a mangled link must not dose a different animal.
  it.each(['0x10', '1e3', '-1', '0', '0.0', '', 'abc', '1,2', '1.2.3', 'Infinity'])('%j → null', s => {
    expect(parseWeightParam(s)).toBeNull();
  });

  it('treats null and undefined as missing', () => {
    expect(parseWeightParam(null)).toBeNull();
    expect(parseWeightParam(undefined)).toBeNull();
  });
});
