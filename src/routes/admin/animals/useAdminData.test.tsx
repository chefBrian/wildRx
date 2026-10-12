import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminData } from './useAdminData';
import * as repos from '../../../firebase/repos';
import { SchemaMismatchError } from '../../../firebase/schemaGuard';
import type { DosingRule } from '../../../domain/types';

vi.mock('../../../firebase/repos', () => ({
  listMedications: vi.fn(), listSpecies: vi.fn(), listAllDosingRules: vi.fn(),
}));

const r = (id: string) => ({ id } as DosingRule);

beforeEach(() => {
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue([r('a')]);
});

describe('useAdminData', () => {
  it('loads meds, species and all rules', async () => {
    const { result } = renderHook(() => useAdminData());
    await waitFor(() => expect(result.current.data?.rules.map(x => x.id)).toEqual(['a']));
  });

  it('drops a load that finishes after a newer one', async () => {
    let finishFirst: (v: DosingRule[]) => void = () => {};
    vi.mocked(repos.listAllDosingRules)
      .mockReturnValueOnce(new Promise(res => { finishFirst = res; }))
      .mockResolvedValueOnce([r('new')]);
    const { result } = renderHook(() => useAdminData());
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data?.rules.map(x => x.id)).toEqual(['new']));
    await act(async () => { finishFirst([r('old')]); });
    expect(result.current.data?.rules.map(x => x.id)).toEqual(['new']);
  });

  it('reports old-shape rules separately from other failures', async () => {
    vi.mocked(repos.listAllDosingRules).mockRejectedValueOnce(new SchemaMismatchError('dosingRules', 'x'));
    const { result } = renderHook(() => useAdminData());
    await waitFor(() => expect(result.current.error).toBe('schemaMismatch'));
  });
});
