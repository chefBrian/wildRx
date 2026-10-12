import { describe, it, expect } from 'vitest';
import { DEFAULT_ROUTES as scriptDefaults } from './defaultRoutes.mjs';
import { DEFAULT_ROUTES } from '../../src/domain/concentrations.ts';

describe('DEFAULT_ROUTES parity', () => {
  it('scripts and src agree for every form', () => {
    expect(Object.keys(scriptDefaults).sort()).toEqual(Object.keys(DEFAULT_ROUTES).sort());
    for (const form of Object.keys(DEFAULT_ROUTES)) {
      expect(scriptDefaults[form]).toEqual([...DEFAULT_ROUTES[form]]);
    }
  });
});
