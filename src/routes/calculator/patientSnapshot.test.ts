import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearPatientSnapshot, getPatientSnapshot } from './patientSnapshot';
import * as repos from '../../firebase/repos';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn(),
  listSpecies: vi.fn(),
  listAllDosingRules: vi.fn(),
}));

beforeEach(() => {
  clearPatientSnapshot();
  vi.mocked(repos.listMedications).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listSpecies).mockReset().mockResolvedValue([]);
  vi.mocked(repos.listAllDosingRules).mockReset().mockResolvedValue([]);
});

describe('patientSnapshot', () => {
  it('loads once and reuses the result', async () => {
    await getPatientSnapshot();
    await getPatientSnapshot();
    expect(repos.listMedications).toHaveBeenCalledTimes(1);
    expect(repos.listAllDosingRules).toHaveBeenCalledTimes(1);
  });

  it('reloads after clearPatientSnapshot', async () => {
    await getPatientSnapshot();
    clearPatientSnapshot();
    await getPatientSnapshot();
    expect(repos.listMedications).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load', async () => {
    vi.mocked(repos.listAllDosingRules).mockRejectedValueOnce(new Error('offline'));
    await expect(getPatientSnapshot()).rejects.toThrow('offline');
    await expect(getPatientSnapshot()).resolves.toEqual({ meds: [], species: [], rules: [] });
    expect(repos.listAllDosingRules).toHaveBeenCalledTimes(2);
  });
});
