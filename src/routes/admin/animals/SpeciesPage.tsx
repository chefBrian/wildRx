import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminData, type AdminData } from './useAdminData';
import { LoadProblem, RefreshProblem } from './LoadProblem';
import { ActionButton } from './ActionButton';
import { SpeciesEditor } from './SpeciesEditor';
import { RuleEditor } from '../rules/RuleEditor';
import { blankRule, copyToSpecies } from '../rules/ruleDrafts';
import { RuleSummary } from '../../../components/RuleSummary';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { createDosingRules, deleteDosingRule, deleteSpecies, listDosingRulesForSpecies, RuleExistsError } from '../../../firebase/repos';
import { actionFailed } from '../actionFailed';
import { medsForSpecies } from '../../../domain/medsForSpecies';
import { groupRuleReach, shadowedGroupRules } from '../../../domain/shadowing';
import { deleteImpact, joinRoutes } from '../../../domain/ruleImpact';
import { formatNumber, formatUnitBadge } from '../../../domain/format';
import { useAuth } from '../../../auth/AuthProvider';
import { formatGroup, type DosingRule, type Medication, type RuleTarget, type Species } from '../../../domain/types';

export function SpeciesPage() {
  const { speciesId = '' } = useParams();
  const { data, error, refreshError, reload } = useAdminData();
  if (error) return <LoadProblem error={error} onRetry={reload} />;
  if (!data) return <div className="text-[14px] italic text-ink2">Loading…</div>;
  const species = data.species.find(s => s.id === speciesId);
  if (!species) {
    return (
      <p className="text-[14px] text-ink2">
        Species not found. <Link to="/admin" className="text-moss-700 underline">Back to animals</Link>
      </p>
    );
  }
  // Keyed so open editors and dialogs never carry over to another species.
  return (
    <div className="space-y-6">
      {refreshError && <RefreshProblem onRetry={reload} />}
      <SpeciesPageView key={species.id} species={species} data={data} reload={reload} />
    </div>
  );
}

interface EditorState {
  anchor: string;
  rule: DosingRule;
  targetChoices: RuleTarget[];
}

interface PendingOverride {
  clicked: DosingRule;
  groupRules: DosingRule[];
}

function SpeciesPageView({ species, data, reload }: { species: Species; data: AdminData; reload: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [editingDetails, setEditingDetails] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DosingRule | null>(null);
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);
  const [confirmSpeciesDelete, setConfirmSpeciesDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const speciesTarget: RuleTarget = { type: 'species', value: species.id };
  const groupTarget: RuleTarget = { type: 'group', value: species.group };
  const groupLabel = formatGroup(species.group);
  const { withRules, withoutRules } = medsForSpecies({ meds: data.meds, rules: data.rules, species });
  const ownRules = data.rules.filter(r => r.target.type === 'species' && r.target.value === species.id);
  const medName = (id: string) => data.meds.find(m => m.id === id)?.name ?? id;
  // Left behind by a deleted medication; they block deleting this species.
  const orphanRules = ownRules.filter(r => !data.meds.some(m => m.id === r.medicationId));

  function openEditor(anchor: string, rule: DosingRule, targetChoices: RuleTarget[]) {
    setEditor({ anchor, rule, targetChoices });
    setEditorKey(k => k + 1);
    setNotice(null);
  }

  function editorAt(anchor: string, fallback: ReactNode) {
    if (!editor || editor.anchor !== anchor) return fallback;
    return (
      <RuleEditor
        key={editorKey}
        rule={editor.rule}
        meds={data.meds}
        species={data.species}
        allRules={data.rules}
        targetChoices={editor.targetChoices}
        onSaved={() => { setEditor(null); reload(); }}
        onCancel={() => setEditor(null)}
        onReload={reload}
      />
    );
  }

  async function confirmOverride() {
    if (!pendingOverride || !user) return;
    const { clicked, groupRules } = pendingOverride;
    const copies = groupRules.map(r => copyToSpecies(r, species.id, user.uid));
    setPendingOverride(null);
    setNotice(null);
    try {
      await createDosingRules(copies);
    } catch (err) {
      setNotice(err instanceof RuleExistsError
        ? `${species.commonName} already has its own rule for ${medName(clicked.medicationId)}. The page has been refreshed.`
        : actionFailed('Override', err));
      reload();
      return;
    }
    reload();
    const opened = copies.find(c => c.route === clicked.route) ?? copies[0];
    openEditor(`rule:${opened.id}`, opened, [speciesTarget]);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    setNotice(null);
    try {
      await deleteDosingRule(id);
    } catch (err) {
      setNotice(actionFailed('Delete', err));
    }
    reload();
  }

  async function deleteThisSpecies() {
    setConfirmSpeciesDelete(false);
    setNotice(null);
    try {
      // The page's rules may be stale (another tab added one): check again before deleting.
      const fresh = await listDosingRulesForSpecies(species.id);
      if (fresh.length > 0) {
        setNotice(ownRulesGuard(fresh));
        reload();
        return;
      }
      await deleteSpecies(species.id);
    } catch (err) {
      setNotice(actionFailed('Delete', err));
      return;
    }
    nav('/admin');
  }

  function ownRulesGuard(rules: DosingRule[]) {
    return `Delete the ${rules.length} species rule${rules.length === 1 ? '' : 's'} for ${species.commonName} first: ${rules.map(r => `${medName(r.medicationId)} ${r.route}`).join(', ')}.`;
  }

  const deleteMessage = pendingDelete
    ? [
        `${pendingDelete.target.type === 'species' ? species.commonName : groupLabel} - ${pendingDelete.route} ${pendingDelete.frequency}.`,
        deleteImpact({ rule: pendingDelete, rules: data.rules, species: data.species, medName: medName(pendingDelete.medicationId) }),
        'This cannot be undone.',
      ].filter(Boolean).join(' ')
    : undefined;

  return (
    <div className="space-y-10">
      {/* Details */}
      <section>
        {editingDetails ? (
          <SpeciesEditor
            species={species}
            allSpecies={data.species}
            meds={data.meds}
            rules={data.rules}
            onSaved={() => { setEditingDetails(false); reload(); }}
            onCancel={() => setEditingDetails(false)}
          />
        ) : (
          <div className="space-y-2">
            <Link to="/admin" className="text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4">← Animals</Link>
            <h2 className="font-display text-[26px] font-semibold text-ink leading-tight">{species.commonName}</h2>
            <div className="text-[13px] italic text-ink2">{species.scientificName}</div>
            <div className="text-[13px] text-ink2">
              Group: <Link to={`/admin/animals/group/${species.group}`} className="text-moss-700 underline">{groupLabel}</Link>
              {' · '}typical {formatNumber(species.typicalWeightKg.min)}-{formatNumber(species.typicalWeightKg.max)} kg
            </div>
            {species.notes && <p className="text-[14px] text-ink">{species.notes}</p>}
            <div className="flex gap-6">
              <ActionButton onClick={() => setEditingDetails(true)}>Edit details</ActionButton>
              <ActionButton danger disabled={ownRules.length > 0} onClick={() => setConfirmSpeciesDelete(true)}>Delete species</ActionButton>
            </div>
            {ownRules.length > 0 && (
              <p className="text-[12px] italic text-ink2">{ownRulesGuard(ownRules)}</p>
            )}
          </div>
        )}
      </section>

      {notice && <div role="status" className="bg-ochre-50 border-l-4 border-ochre-600 px-4 py-3 text-[13px] text-ink">{notice}</div>}

      {/* Rules in effect */}
      <section className="space-y-6">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink2">Rules in effect</h3>
        {withRules.length === 0 && <p className="text-[14px] italic text-ink2">No medication has a rule for {species.commonName} yet.</p>}
        {withRules.map(({ med, matched }) => {
          const viaGroup = matched[0].source === 'group';
          const hidden = shadowedGroupRules({ rules: data.rules, species, medicationId: med.id });
          const reach = groupRuleReach({ rules: data.rules, species: data.species, group: species.group, medicationId: med.id }).length;
          const addAnchor = `new:${med.id}`;
          return (
            <div key={med.id} className="space-y-2">
              <MedHeading med={med} />
              {matched.map(r => (
                <div key={r.id}>
                  {editorAt(`rule:${r.id}`, (
                    <RuleSummary rule={r} unit={med.doseUnit} sourceLabel={r.source === 'species' ? 'species' : groupLabel}>
                      {r.source === 'species' ? (
                        <>
                          <ActionButton onClick={() => openEditor(`rule:${r.id}`, r, [speciesTarget])}>Edit</ActionButton>
                          <ActionButton danger onClick={() => setPendingDelete(r)}>Delete</ActionButton>
                        </>
                      ) : (
                        <>
                          <ActionButton onClick={() => openEditor(`rule:${r.id}`, r, [groupTarget])}>
                            Edit {groupLabel} rule - applies to {reach} species
                          </ActionButton>
                          <ActionButton onClick={() => setPendingOverride({ clicked: r, groupRules: matched })}>
                            Override for this species
                          </ActionButton>
                        </>
                      )}
                    </RuleSummary>
                  ))}
                </div>
              ))}
              {hidden.length > 0 && (
                <div className="space-y-2 pl-4 border-l-2 border-taupe/60">
                  <div className="text-[12px] italic text-ink2">Hidden by species rule:</div>
                  {hidden.map(r => <RuleSummary key={r.id} rule={r} unit={med.doseUnit} sourceLabel={groupLabel} dimmed />)}
                </div>
              )}
              {editorAt(addAnchor, (
                <ActionButton onClick={() => openEditor(
                  addAnchor,
                  blankRule(med.id, viaGroup ? groupTarget : speciesTarget),
                  // A new group rule would be hidden at once while species rules are in effect.
                  viaGroup ? [groupTarget, speciesTarget] : [speciesTarget],
                )}>
                  + Add route
                </ActionButton>
              ))}
            </div>
          );
        })}
      </section>

      {orphanRules.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink2">Rules for deleted medications</h3>
          <p className="text-[12px] italic text-ink2">These rules point at a medication that no longer exists. They never show in the calculator.</p>
          <ul className="space-y-2">
            {orphanRules.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-4 bg-surface border border-taupe rounded-md px-4 py-2">
                <span className="text-[14px] text-ink">
                  <span className="font-mono">{r.medicationId}</span> - {r.route}
                </span>
                <ActionButton danger onClick={() => setPendingDelete(r)}>Delete</ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* No rule */}
      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink2">No rule</h3>
        {withoutRules.length === 0 && <p className="text-[14px] italic text-ink2">Every medication has a rule for {species.commonName}.</p>}
        <ul className="space-y-2">
          {withoutRules.map(med => (
            <li key={med.id}>
              {editorAt(`new:${med.id}`, (
                <div className="flex items-center justify-between gap-4 bg-surface border border-taupe rounded-md px-4 py-2">
                  <span className="text-[15px] text-ink">{med.name}</span>
                  <button
                    type="button"
                    aria-label={`Add rule for ${med.name}`}
                    onClick={() => openEditor(`new:${med.id}`, blankRule(med.id, speciesTarget), [speciesTarget, groupTarget])}
                    className="min-h-[44px] inline-flex items-center text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4 decoration-1"
                  >
                    + Add rule
                  </button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this rule?"
        message={deleteMessage}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={pendingOverride !== null}
        title={`Override for ${species.commonName}?`}
        message={pendingOverride
          ? `Copies the ${groupLabel} ${joinRoutes(pendingOverride.groupRules)} rule${pendingOverride.groupRules.length === 1 ? '' : 's'} to ${species.commonName} so you can change them. Doses don't change until you edit.`
          : undefined}
        confirmLabel="Copy rules"
        onConfirm={confirmOverride}
        onCancel={() => setPendingOverride(null)}
      />
      <ConfirmDialog
        open={confirmSpeciesDelete}
        title="Delete this species?"
        message={`${species.commonName} will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteThisSpecies}
        onCancel={() => setConfirmSpeciesDelete(false)}
      />
    </div>
  );
}

function MedHeading({ med }: { med: Medication }) {
  return (
    <div className="flex items-center gap-2">
      <h4 className="font-display text-[17px] text-ink">{med.name}</h4>
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-cream text-ink2 text-[11px] font-medium uppercase tracking-[0.08em]">
        {formatUnitBadge(med.doseUnit)}
      </span>
    </div>
  );
}
