import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuleEditor, type RuleEditorProps } from './RuleEditor';
import { blankRule } from './ruleDrafts';
import * as repos from '../../../firebase/repos';
import type { DosingRule, Medication, Species } from '../../../domain/types';

vi.mock('../../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));

// The mocked module's RuleExistsError is the one RuleEditor imports, so `instanceof` works.
// (Don't importActual repos: it would initialize Firebase from src/firebase/client.ts.)
vi.mock('../../../firebase/repos', () => {
  class RuleExistsError extends Error {
    readonly id: string;
    constructor(id: string) { super(id); this.id = id; }
  }
  return {
    RuleExistsError,
    createDosingRule: vi.fn(),
    upsertDosingRule: vi.fn(),
    rekeyDosingRule: vi.fn(),
  };
});

const vita: Medication = { id: 'vita', name: 'Vitamin A', doseUnit: 'IU', concentrations: [{ id: 'c1', value: 50000, form: 'injectable' }] };
const melox: Medication = { id: 'melox', name: 'Meloxicam', doseUnit: 'mg', concentrations: [] };
const baytril: Medication = { id: 'baytril', name: 'Baytril', doseUnit: 'mg', concentrations: [] };
const ebt: Species = { id: 'ebt', commonName: 'Eastern Box Turtle', scientificName: 'Terrapene carolina', group: 'reptile', typicalWeightKg: { min: 0.3, max: 0.5 } };
const existingRule: DosingRule = {
  id: 'vita__group-reptile__IM', medicationId: 'vita', target: { type: 'group', value: 'reptile' },
  dosePerKg: { min: 1000, typical: 1500, max: 2000 }, route: 'IM', frequency: 'q7d',
  durationDays: null, maxSingleDose: null, contraindications: [], notes: '', updatedAt: 0, updatedBy: 'u1',
};

beforeEach(() => {
  vi.mocked(repos.createDosingRule).mockReset().mockResolvedValue(undefined);
  vi.mocked(repos.upsertDosingRule).mockReset().mockResolvedValue(undefined);
  vi.mocked(repos.rekeyDosingRule).mockReset().mockResolvedValue(undefined);
});

function renderEditor(overrides: Partial<RuleEditorProps> = {}) {
  const props: RuleEditorProps = {
    rule: existingRule, meds: [vita], species: [ebt], allRules: [existingRule],
    targetChoices: [existingRule.target],
    onSaved: vi.fn(), onCancel: vi.fn(), onReload: vi.fn(),
    ...overrides,
  };
  render(<RuleEditor {...props} />);
  return props;
}

const save = () => screen.getByRole('button', { name: /^save$/i });

describe('RuleEditor - fields (moved from RulesTab)', () => {
  it('labels doses in the med unit and says per dose', () => {
    renderEditor();
    expect(screen.getByText('Dose per kg, per dose (IU/kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Max single dose (IU, blank = none)')).toBeInTheDocument();
  });

  it('previews at the target typical weight range and flags unmeasurable volumes', () => {
    renderEditor();
    // 0.3 kg × 1500 = 450 IU ÷ 50,000 = 0.009 ml (too small); 0.5 kg → 750 IU = 0.015 ml
    expect(screen.getByText(/^0\.3 kg: 450 IU = 0\.009 ml @ 50,000 IU\/ml \(too small to measure\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^0\.5 kg: 750 IU = 0\.015 ml @ 50,000 IU\/ml$/)).toBeInTheDocument();
  });

  it('disables Save when typical is blank', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByLabelText('Typical'));
    expect(save()).toBeDisabled();
  });

  it('saves blank min and max as typical, in place', async () => {
    const user = userEvent.setup();
    const props = renderEditor();
    await user.clear(screen.getByLabelText('Min'));
    await user.clear(screen.getByLabelText('Max'));
    await user.click(save());
    expect(repos.upsertDosingRule).toHaveBeenCalledWith(expect.objectContaining({
      id: 'vita__group-reptile__IM', dosePerKg: { min: 1500, typical: 1500, max: 1500 }, updatedBy: 'u1',
    }));
    expect(props.onSaved).toHaveBeenCalled();
  });

  it('saves a dose typed with a leading zero exactly', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByLabelText('Min'));
    await user.clear(screen.getByLabelText('Max'));
    await user.clear(screen.getByLabelText('Typical'));
    await user.type(screen.getByLabelText('Typical'), '0.01');
    await user.click(save());
    expect(repos.upsertDosingRule).toHaveBeenCalledWith(expect.objectContaining({
      dosePerKg: { min: 0.01, typical: 0.01, max: 0.01 },
    }));
  });

  it('rejects unparseable Max instead of saving it as typical', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByLabelText('Max'));
    await user.type(screen.getByLabelText('Max'), '2,000');
    expect(screen.getByText('Enter a plain number.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('rejects a negative Min', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.clear(screen.getByLabelText('Min'));
    await user.type(screen.getByLabelText('Min'), '-5');
    expect(save()).toBeDisabled();
  });
});

describe('RuleEditor - ids and targets', () => {
  it('fixes med and target on an existing rule', () => {
    renderEditor({ targetChoices: [existingRule.target, { type: 'species', value: 'ebt' }] });
    expect(screen.queryByLabelText('Medication')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Applies to')).not.toBeInTheDocument();
    expect(screen.getByText(/target is fixed once a rule is created/i)).toBeInTheDocument();
  });

  it('creates a new rule at its stable id', async () => {
    const user = userEvent.setup();
    renderEditor({ rule: blankRule('vita', { type: 'group', value: 'reptile' }), allRules: [] });
    await user.type(screen.getByLabelText('Typical'), '1500');
    await user.selectOptions(screen.getByLabelText('Route'), 'PO');
    await user.click(save());
    expect(repos.createDosingRule).toHaveBeenCalledWith(expect.objectContaining({ id: 'vita__group-reptile__PO' }));
  });

  it('refuses a duplicate route for the same med and target', async () => {
    const user = userEvent.setup();
    renderEditor({ rule: blankRule('vita', { type: 'group', value: 'reptile' }) });
    await user.type(screen.getByLabelText('Typical'), '1500');
    await user.selectOptions(screen.getByLabelText('Route'), 'IM');
    expect(screen.getByText('Vitamin A / Reptile (group): a rule for IM already exists - edit that one instead.')).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it('treats a legacy-id rule with the same fields as a duplicate', async () => {
    const user = userEvent.setup();
    const legacy = { ...existingRule, id: 'vita__group-reptile' };
    renderEditor({ rule: blankRule('vita', { type: 'group', value: 'reptile' }), allRules: [legacy] });
    await user.type(screen.getByLabelText('Typical'), '1500');
    await user.selectOptions(screen.getByLabelText('Route'), 'IM');
    expect(save()).toBeDisabled();
  });

  it('re-keys when the route changes', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.selectOptions(screen.getByLabelText('Route'), 'SC');
    await user.click(save());
    expect(repos.rekeyDosingRule).toHaveBeenCalledWith('vita__group-reptile__IM', expect.objectContaining({ id: 'vita__group-reptile__SC', route: 'SC' }));
  });

  it('shows a bottle not set for the rule route as "not for" in the preview', async () => {
    const user = userEvent.setup();
    const imOnly: Medication = { ...vita, concentrations: [{ id: 'c1', value: 50000, form: 'injectable', routes: ['IM'] }] };
    renderEditor({ meds: [imOnly] });
    await user.selectOptions(screen.getByLabelText('Route'), 'SC');
    expect(screen.getByText(/^0\.3 kg: 450 IU = not for SC @ 50,000 IU\/ml$/)).toBeInTheDocument();
  });

  it('re-keys a legacy id on save', async () => {
    const user = userEvent.setup();
    const legacy = { ...existingRule, id: '3f2a9c1e-uuid' };
    renderEditor({ rule: legacy, allRules: [legacy] });
    await user.click(save());
    expect(repos.rekeyDosingRule).toHaveBeenCalledWith('3f2a9c1e-uuid', expect.objectContaining({ id: 'vita__group-reptile__IM' }));
  });

  it('reports a rule created elsewhere meanwhile and reloads', async () => {
    vi.mocked(repos.createDosingRule).mockRejectedValueOnce(new repos.RuleExistsError('vita__group-reptile__PO'));
    const user = userEvent.setup();
    const props = renderEditor({ rule: blankRule('vita', { type: 'group', value: 'reptile' }), allRules: [] });
    await user.type(screen.getByLabelText('Typical'), '1500');
    await user.selectOptions(screen.getByLabelText('Route'), 'PO');
    await user.click(save());
    expect(await screen.findByText(/a rule for PO already exists/)).toBeInTheDocument();
    expect(props.onReload).toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('warns which group rules a first species rule will hide', async () => {
    const user = userEvent.setup();
    renderEditor({
      rule: blankRule('vita', { type: 'species', value: 'ebt' }),
      targetChoices: [{ type: 'species', value: 'ebt' }, { type: 'group', value: 'reptile' }],
    });
    expect(screen.getByText("Saving this hides the Reptile group's IM rule for Eastern Box Turtle.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Applies to'), 'group:reptile');
    expect(screen.queryByText(/saving this hides/i)).not.toBeInTheDocument();
  });

  it('shows a write failure instead of failing silently', async () => {
    vi.mocked(repos.upsertDosingRule).mockRejectedValueOnce(new Error('Missing or insufficient permissions.'));
    const user = userEvent.setup();
    const props = renderEditor();
    await user.click(save());
    expect(await screen.findByText('Save failed: Missing or insufficient permissions.')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('writes once when Save is tapped twice', async () => {
    let finish: () => void = () => {};
    vi.mocked(repos.upsertDosingRule).mockReturnValueOnce(new Promise<void>(r => { finish = r; }));
    const user = userEvent.setup();
    renderEditor();
    await user.click(save());
    expect(save()).toBeDisabled();
    await user.click(save());
    finish();
    expect(repos.upsertDosingRule).toHaveBeenCalledTimes(1);
  });
});

describe('RuleEditor - medication switch and cancel', () => {
  const reptile = { type: 'group', value: 'reptile' } as const;

  it('clears typed doses when the new med has a different unit', async () => {
    const user = userEvent.setup();
    renderEditor({ rule: blankRule('melox', reptile), meds: [melox, vita], allRules: [] });
    await user.type(screen.getByLabelText('Typical'), '0.2');
    expect(save()).toBeEnabled();
    await user.selectOptions(screen.getByLabelText('Medication'), 'vita');
    expect(screen.getByLabelText('Typical')).toHaveValue('');
    expect(save()).toBeDisabled();
  });

  it('keeps typed doses when the new med has the same unit', async () => {
    const user = userEvent.setup();
    renderEditor({ rule: blankRule('melox', reptile), meds: [melox, baytril], allRules: [] });
    await user.type(screen.getByLabelText('Typical'), '0.2');
    await user.selectOptions(screen.getByLabelText('Medication'), 'baytril');
    expect(screen.getByLabelText('Typical')).toHaveValue('0.2');
    expect(save()).toBeEnabled();
  });

  it('disables Save when the rule medication is not loaded', () => {
    renderEditor({ rule: { ...existingRule, medicationId: 'gone', id: 'gone__group-reptile__IM' }, meds: [vita], allRules: [] });
    expect(save()).toBeDisabled();
  });

  it('disables Cancel while a save is in flight', async () => {
    vi.mocked(repos.upsertDosingRule).mockReturnValueOnce(new Promise<void>(() => {}));
    const user = userEvent.setup();
    renderEditor();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeEnabled();
    await user.click(save());
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled();
  });
});
