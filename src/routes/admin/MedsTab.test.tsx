import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MedsTab } from './MedsTab';
import type { DosingRule, Medication } from '../../domain/types';

vi.mock('../../firebase/repos', () => ({
  listMedications: vi.fn(),
  listDosingRulesForMed: vi.fn(),
  upsertMedication: vi.fn().mockResolvedValue(undefined),
  deleteMedicationWithRules: vi.fn().mockResolvedValue(undefined),
}));

const meloxicam: Medication = {
  id: 'm1', name: 'Meloxicam', doseUnit: 'mg',
  concentrations: [{ id: 'c1', value: 1.5, form: 'oral' }],
};

beforeEach(async () => {
  const repos = await import('../../firebase/repos');
  vi.mocked(repos.listMedications).mockResolvedValue([meloxicam]);
  vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([]);
  vi.mocked(repos.upsertMedication).mockClear();
});

describe('MedsTab', () => {
  it('lists meds with their unit badge', async () => {
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    expect(screen.getByText('mg')).toBeInTheDocument();
  });

  it('has no unit preselected and keeps Save disabled until one is chosen', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await user.type(screen.getByLabelText(/^name$/i), 'Amoxicillin');
    expect((screen.getByLabelText(/dosed in/i) as HTMLSelectElement).value).toBe('');
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/dosed in/i), 'mg');
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });

  it('saves a valid mg med with a concentration', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '62.5');
    await user.type(screen.getByLabelText(/concentration 1 note/i), 'Clavamox');
    await user.click(screen.getByRole('button', { name: /save/i }));
    const { upsertMedication } = await import('../../firebase/repos');
    expect(upsertMedication).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Amoxicillin',
      doseUnit: 'mg',
      concentrations: [expect.objectContaining({ value: 62.5, form: 'oral', note: 'Clavamox' })],
    }));
  });

  it('saves a strength typed with a leading zero exactly', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '0.05');
    await user.click(screen.getByRole('button', { name: /save/i }));
    const { upsertMedication } = await import('../../firebase/repos');
    expect(upsertMedication).toHaveBeenCalledWith(expect.objectContaining({
      concentrations: [expect.objectContaining({ value: 0.05 })],
    }));
  });

  it('disables Save for a missing strength', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '');
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(screen.getByText('Enter a strength above 0.')).toBeInTheDocument();
  });

  it('disables Save when a note states a strength', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '50');
    await user.type(screen.getByLabelText(/concentration 1 note/i), '50mg/ml');
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('switching to ml clears concentrations and requires a product', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await user.type(screen.getByLabelText(/^name$/i), 'Pepto-Bismol');
    await user.selectOptions(screen.getByLabelText(/dosed in/i), 'mg');
    await user.click(screen.getByText(/add concentration/i));
    await user.selectOptions(screen.getByLabelText(/dosed in/i), 'ml');
    expect(screen.queryByLabelText(/concentration 1 strength/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/^product$/i), 'Pepto-Bismol Original (17.5 mg/ml)');
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /save/i }));
    const { upsertMedication } = await import('../../firebase/repos');
    expect(upsertMedication).toHaveBeenCalledWith(expect.objectContaining({
      doseUnit: 'ml', concentrations: [], productDescription: 'Pepto-Bismol Original (17.5 mg/ml)',
    }));
  });

  it('clears strengths when switching between mg and IU, keeping form and note', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '5');
    await user.type(screen.getByLabelText(/concentration 1 note/i), 'Clavamox');
    await user.selectOptions(screen.getByLabelText(/dosed in/i), 'IU');
    expect(screen.getByLabelText(/concentration 1 strength/i)).toHaveValue('');
    expect(screen.getByLabelText(/concentration 1 form/i)).toHaveValue('oral');
    expect(screen.getByLabelText(/concentration 1 note/i)).toHaveValue('Clavamox');
    expect(screen.getByLabelText('Concentration 1 PO')).toBeChecked();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/concentration 1 strength/i), '5');
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });

  it('clears strengths when switching mg -> Choose unit -> IU', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '5');
    await user.selectOptions(screen.getByLabelText(/dosed in/i), '');
    await user.selectOptions(screen.getByLabelText(/dosed in/i), 'IU');
    expect(screen.getByLabelText(/concentration 1 strength/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('locks the unit when the med has rules', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }] as DosingRule[]);
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => expect(screen.getByText(/2 rules use this unit/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/dosed in/i)).toBeDisabled();
  });

  it('keeps the unit locked while the rule count is still loading', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockReturnValue(new Promise(() => {})); // never resolves
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByLabelText(/dosed in/i)).toBeDisabled();
    expect(screen.getByText(/checking rules/i)).toBeInTheDocument();
  });

  it('shows a failure message and keeps the unit locked when the rule lookup fails', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockRejectedValue(new Error('schema mismatch'));
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => expect(screen.getByText("Couldn't check rules - unit locked.")).toBeInTheDocument());
    expect(screen.getByLabelText(/dosed in/i)).toBeDisabled();
    expect(screen.queryByText(/checking rules/i)).not.toBeInTheDocument();
  });

  it('ticks the form defaults on a new bottle and follows form changes until touched', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '5'); // selects form 'oral'
    expect(screen.getByLabelText('Concentration 1 PO')).toBeChecked();
    expect(screen.getByLabelText('Concentration 1 IM')).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText(/concentration 1 form/i), 'injectable');
    expect(screen.getByLabelText('Concentration 1 IM')).toBeChecked();
    expect(screen.getByLabelText('Concentration 1 SC')).toBeChecked();
    expect(screen.getByLabelText('Concentration 1 IV')).not.toBeChecked();
    await user.click(screen.getByLabelText('Concentration 1 PO')); // touched
    await user.selectOptions(screen.getByLabelText(/concentration 1 form/i), 'oral');
    expect(screen.getByLabelText('Concentration 1 IM')).toBeChecked(); // kept, not reset
    expect(screen.getByText('An oral bottle is ticked for IM, SC - check the label.')).toBeInTheDocument();
  });

  it('treats bottles loaded from the database as touched, with routes filled in', async () => {
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByLabelText('Concentration 1 PO')).toBeChecked(); // oral default filled
    await user.selectOptions(screen.getByLabelText(/concentration 1 form/i), 'injectable');
    expect(screen.getByLabelText('Concentration 1 IM')).not.toBeChecked(); // not reset to defaults
  });

  it('notes IV and blocks a bottle with no routes', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '5');
    await user.click(screen.getByLabelText('Concentration 1 IV'));
    expect(screen.getByText("Only tick IV if the label says it's safe IV.")).toBeInTheDocument();
    await user.click(screen.getByLabelText('Concentration 1 IV'));
    await user.click(screen.getByLabelText('Concentration 1 PO'));
    expect(screen.getByText('Choose at least one route.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('warns when this med has rules for a route no bottle allows', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([{ id: 'r1', route: 'IM' }] as DosingRule[]);
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(await screen.findByText("This med has IM rules but no bottle allows IM. The calculator will show 'No bottle on file' for them.")).toBeInTheDocument();
  });

  it("drops one med's orphan-route warning when another med's rules are still loading", async () => {
    const repos = await import('../../firebase/repos');
    const medB: Medication = { id: 'm2', name: 'Penicillin', doseUnit: 'IU', concentrations: [{ id: 'c2', value: 300000, form: 'injectable' }] };
    vi.mocked(repos.listMedications).mockResolvedValue([meloxicam, medB]);
    vi.mocked(repos.listDosingRulesForMed).mockImplementation(id =>
      id === 'm1' ? Promise.resolve([{ id: 'r1', route: 'IM' }] as DosingRule[]) : new Promise(() => {}));
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Penicillin'));
    const warning = "This med has IM rules but no bottle allows IM. The calculator will show 'No bottle on file' for them.";
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0]);
    expect(await screen.findByText(warning)).toBeInTheDocument();
    await user.click(within(screen.getByText('Penicillin').closest('li')!).getByRole('button', { name: /edit/i }));
    await screen.findByText(/checking rules/i);
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it('saves routes and the schema version', async () => {
    const user = userEvent.setup();
    await startNew(user);
    await addMgConcentration(user, '62.5');
    await user.click(screen.getByRole('button', { name: /save/i }));
    const { upsertMedication } = await import('../../firebase/repos');
    expect(upsertMedication).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 2,
      concentrations: [expect.objectContaining({ routes: ['PO'] })],
    }));
  });

  it('links each medication to its fact sheet', async () => {
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    expect(screen.getByRole('link', { name: 'Fact sheet' })).toHaveAttribute('href', '/meds/m1');
  });
});

describe('MedsTab delete', () => {
  it('confirms with the rule count and deletes the med with its rules', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([{ id: 'r1' }, { id: 'r2' }] as DosingRule[]);
    vi.mocked(repos.deleteMedicationWithRules).mockClear();
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText('Meloxicam and its 2 dosing rules will be deleted. This cannot be undone.')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(repos.deleteMedicationWithRules).toHaveBeenCalledWith('m1'));
  });

  it('says "1 dosing rule" for a single rule', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockResolvedValue([{ id: 'r1' }] as DosingRule[]);
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByText('Meloxicam and its 1 dosing rule will be deleted. This cannot be undone.')).toBeInTheDocument();
  });

  it('does not allow the delete when the rule lookup fails', async () => {
    const repos = await import('../../firebase/repos');
    vi.mocked(repos.listDosingRulesForMed).mockRejectedValue(new Error('schema mismatch'));
    vi.mocked(repos.deleteMedicationWithRules).mockClear();
    const user = userEvent.setup();
    render(<MedsTab />);
    await waitFor(() => screen.getByText('Meloxicam'));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't check this medication's rules/i);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(repos.deleteMedicationWithRules).not.toHaveBeenCalled();
  });
});

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  render(<MedsTab />);
  await waitFor(() => screen.getByText('Meloxicam'));
  await user.click(screen.getByText(/add medication/i));
}

async function addMgConcentration(user: ReturnType<typeof userEvent.setup>, strength: string) {
  await user.type(screen.getByLabelText(/^name$/i), 'Amoxicillin');
  await user.selectOptions(screen.getByLabelText(/dosed in/i), 'mg');
  await user.click(screen.getByText(/add concentration/i));
  if (strength) await user.type(screen.getByLabelText(/concentration 1 strength/i), strength);
  await user.selectOptions(screen.getByLabelText(/concentration 1 form/i), 'oral');
}
