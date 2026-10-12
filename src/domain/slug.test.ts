import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Red-tailed Hawk', 'red-tailed-hawk'],
    ['Eastern Screech-Owl', 'eastern-screech-owl'],
    ["  Cooper's   Hawk ", 'cooper-s-hawk'],
    ['Pileated Woodpecker (juvenile)', 'pileated-woodpecker-juvenile'],
    ['Égret', 'egret'],
    ['---', ''],
  ])('%j → %j', (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });
});
