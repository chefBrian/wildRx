import { describe, it, expect } from 'vitest';
import { resolveConcentration, allowedRoutes, bottleAllowsRoute, formatRoutes, normalizeRoutes, DEFAULT_ROUTES } from './concentrations';
import type { Concentration, Medication } from './types';

const med = (over: Partial<Medication> = {}): Medication => ({
  id: 'm1', name: 'Enrofloxacin', doseUnit: 'mg',
  concentrations: [
    { id: 'oral', value: 22.7, form: 'oral' },
    { id: 'inj', value: 100, form: 'injectable' },
  ],
  ...over,
});

describe('resolveConcentration', () => {
  it('returns none for ml meds', () => {
    expect(resolveConcentration(med({ doseUnit: 'ml', concentrations: [] }), null)).toEqual({ status: 'none' });
  });

  it('returns none when the med has no concentrations', () => {
    expect(resolveConcentration(med({ concentrations: [] }), null)).toEqual({ status: 'none' });
  });

  it('uses the only concentration regardless of the id', () => {
    const only = { id: 'x', value: 5, form: 'oral' as const };
    expect(resolveConcentration(med({ concentrations: [only] }), 'whatever'))
      .toEqual({ status: 'selected', concentration: only });
  });

  it('selects by id', () => {
    const r = resolveConcentration(med(), 'inj');
    expect(r.status === 'selected' && r.concentration.value).toBe(100);
  });

  it('needs a pick when the id is missing', () => {
    expect(resolveConcentration(med(), null)).toEqual({ status: 'needsPick' });
  });

  it('needs a pick for an old index-style id', () => {
    expect(resolveConcentration(med(), '1')).toEqual({ status: 'needsPick' });
  });
});

describe('route helpers', () => {
  const inj = (routes?: Concentration['routes']): Concentration => ({ id: 'c', value: 1, form: 'injectable', routes });

  it('reads explicit routes', () => {
    expect(allowedRoutes(inj(['IM', 'SC']))).toEqual(['IM', 'SC']);
  });

  it('falls back to the form defaults when routes are missing - never unrestricted', () => {
    expect(allowedRoutes(inj())).toEqual(['PO', 'IM', 'SC']);
    expect(allowedRoutes({ id: 'c', value: 1, form: 'oral' })).toEqual(['PO']);
    expect(allowedRoutes({ id: 'c', value: 1, form: 'topical' })).toEqual(['topical']);
    expect(allowedRoutes({ id: 'c', value: 1, form: 'other' })).toEqual([]);
  });

  it('never defaults IV', () => {
    for (const routes of Object.values(DEFAULT_ROUTES)) expect(routes).not.toContain('IV');
  });

  it('returns a copy, so callers cannot change the defaults', () => {
    const r = allowedRoutes(inj());
    r.push('IV');
    expect(DEFAULT_ROUTES.injectable).toEqual(['PO', 'IM', 'SC']);
  });

  it('treats an unknown form as no routes', () => {
    expect(allowedRoutes({ id: 'c', value: 1, form: 'spray' as Concentration['form'] })).toEqual([]);
  });

  it('checks a route against the bottle', () => {
    expect(bottleAllowsRoute(inj(['IM', 'SC']), 'IV')).toBe(false);
    expect(bottleAllowsRoute(inj(['IM', 'SC']), 'IM')).toBe(true);
    expect(bottleAllowsRoute(inj(), 'PO')).toBe(true);
  });

  it('formats and normalizes route lists', () => {
    expect(formatRoutes(['IM', 'SC'])).toBe('IM, SC');
    expect(formatRoutes([])).toBe('no routes');
    expect(normalizeRoutes(['SC', 'PO', 'SC', 'IV'])).toEqual(['PO', 'SC', 'IV']);
  });
});
