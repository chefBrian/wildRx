import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdminData, type AdminData } from './useAdminData';
import { LoadProblem, RefreshProblem } from './LoadProblem';
import { ActionButton } from './ActionButton';
import { RuleEditor } from '../rules/RuleEditor';
import { blankRule } from '../rules/ruleDrafts';
import { RuleSummary } from '../../../components/RuleSummary';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { deleteDosingRule } from '../../../firebase/repos';
import { actionFailed } from '../actionFailed';
import { overridingSpecies } from '../../../domain/shadowing';
import { deleteImpact } from '../../../domain/ruleImpact';
import { formatUnitBadge } from '../../../domain/format';
import { GROUPS, formatGroup, type DosingRule, type RuleTarget, type TaxonomicGroup } from '../../../domain/types';

export function GroupPage() {
  const { group = '' } = useParams();
  const { data, error, refreshError, reload } = useAdminData();
  if (!GROUPS.includes(group as TaxonomicGroup)) {
    return (
      <p className="text-[14px] text-ink2">
        Unknown group. <Link to="/admin" className="text-moss-700 underline">Back to animals</Link>
      </p>
    );
  }
  if (error) return <LoadProblem error={error} onRetry={reload} />;
  if (!data) return <div className="text-[14px] italic text-ink2">Loading…</div>;
  return (
    <div className="space-y-6">
      {refreshError && <RefreshProblem onRetry={reload} />}
      <GroupPageView key={group} group={group as TaxonomicGroup} data={data} reload={reload} />
    </div>
  );
}

function GroupPageView({ group, data, reload }: { group: TaxonomicGroup; data: AdminData; reload: () => void }) {
  const [editor, setEditor] = useState<{ anchor: string; rule: DosingRule } | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<DosingRule | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const groupTarget: RuleTarget = { type: 'group', value: group };
  const label = formatGroup(group);
  const groupRules = data.rules.filter(r => r.target.type === 'group' && r.target.value === group);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const medsWith = data.meds.filter(m => groupRules.some(r => r.medicationId === m.id)).sort(byName);
  const medsWithout = data.meds.filter(m => !groupRules.some(r => r.medicationId === m.id)).sort(byName);
  const speciesInGroup = data.species.filter(s => s.group === group).sort((a, b) => a.commonName.localeCompare(b.commonName));
  const medName = (id: string) => data.meds.find(m => m.id === id)?.name ?? id;

  function openEditor(anchor: string, rule: DosingRule) {
    setEditor({ anchor, rule });
    setEditorKey(k => k + 1);
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
        targetChoices={[groupTarget]}
        onSaved={() => { setEditor(null); reload(); }}
        onCancel={() => setEditor(null)}
        onReload={reload}
      />
    );
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

  const deleteMessage = pendingDelete
    ? [
        `${label} - ${pendingDelete.route} ${pendingDelete.frequency}.`,
        deleteImpact({ rule: pendingDelete, rules: data.rules, species: data.species, medName: medName(pendingDelete.medicationId) }),
        'This cannot be undone.',
      ].filter(Boolean).join(' ')
    : undefined;

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <Link to="/admin" className="text-[12px] uppercase tracking-[0.1em] text-moss-700 underline underline-offset-4">← Animals</Link>
        <h2 className="font-display text-[26px] font-semibold text-ink leading-tight">{label}</h2>
        {speciesInGroup.length === 0 ? (
          <p className="text-[13px] italic text-ink2">No species in this group yet.</p>
        ) : (
          <div className="text-[13px] text-ink2 flex flex-wrap gap-x-3">
            {speciesInGroup.map(s => (
              <Link key={s.id} to={`/admin/animals/species/${encodeURIComponent(s.id)}`} className="text-moss-700 underline">{s.commonName}</Link>
            ))}
          </div>
        )}
      </section>

      {notice && <div role="status" className="bg-ochre-50 border-l-4 border-ochre-600 px-4 py-3 text-[13px] text-ink">{notice}</div>}

      <section className="space-y-6">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink2">Group rules</h3>
        {medsWith.length === 0 && <p className="text-[14px] italic text-ink2">No group rules for {label} yet.</p>}
        {medsWith.map(med => {
          const overriding = overridingSpecies({ rules: data.rules, species: data.species, group, medicationId: med.id });
          const addAnchor = `new:${med.id}`;
          return (
            <div key={med.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-display text-[17px] text-ink">{med.name}</h4>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-cream text-ink2 text-[11px] font-medium uppercase tracking-[0.08em]">
                  {formatUnitBadge(med.doseUnit)}
                </span>
              </div>
              {overriding.length > 0 && (
                <p className="text-[12px] italic text-ink2">Overridden in: {overriding.map(s => s.commonName).join(', ')}</p>
              )}
              {groupRules.filter(r => r.medicationId === med.id).map(r => (
                <div key={r.id}>
                  {editorAt(`rule:${r.id}`, (
                    <RuleSummary rule={r} unit={med.doseUnit} sourceLabel={label}>
                      <ActionButton onClick={() => openEditor(`rule:${r.id}`, r)}>Edit</ActionButton>
                      <ActionButton danger onClick={() => setPendingDelete(r)}>Delete</ActionButton>
                    </RuleSummary>
                  ))}
                </div>
              ))}
              {editorAt(addAnchor, (
                <ActionButton onClick={() => openEditor(addAnchor, blankRule(med.id, groupTarget))}>+ Add route</ActionButton>
              ))}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-ink2">No group rule</h3>
        <ul className="space-y-2">
          {medsWithout.map(med => (
            <li key={med.id}>
              {editorAt(`new:${med.id}`, (
                <div className="flex items-center justify-between gap-4 bg-surface border border-taupe rounded-md px-4 py-2">
                  <span className="text-[15px] text-ink">{med.name}</span>
                  <button
                    type="button"
                    aria-label={`Add rule for ${med.name}`}
                    onClick={() => openEditor(`new:${med.id}`, blankRule(med.id, groupTarget))}
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
    </div>
  );
}
