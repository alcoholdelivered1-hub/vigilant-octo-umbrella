import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import SetupField from '@/components/onboarding/SetupField';
import SetupReviewControls from '@/components/onboarding/SetupReviewControls';
export default function SetupStepEditor({ step, store, record, history, isAdmin, blocked, onSaved, focused, targetField, onDraftPending }) {
  const [fields,setFields] = useState(() => Object.fromEntries(step.fields.map(f => [f.key,record?.fields?.[f.key] ?? (f.type === 'checkbox' ? !!store[f.key] : String(store[f.key] ?? ''))])));
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const formRef = useRef(null), draftRef = useRef(record), inFlight = useRef(false);
  const [savedFields, setSavedFields] = useState(() => JSON.stringify(fields));
  const [showAll, setShowAll] = useState(!!targetField);
  const [remainingKeys] = useState(() => step.fields.filter(field => field.type === 'checkbox' || !String(fields[field.key] ?? '').trim()).map(field => field.key));
  const dirty = JSON.stringify(fields) !== savedFields;
  useEffect(() => { onDraftPending?.(step.key, dirty || busy); }, [step.key, dirty, busy, onDraftPending]);
  const changeField = (key, value) => { setError(''); setNotice(''); setFields(current => ({ ...current, [key]: value })); };
  const missing = step.fields.filter(field => (field.required || (step.key === 'operations' && !fields.sunday_closed && ['sunday_hours_start','sunday_hours_end'].includes(field.key))) && field.type !== 'checkbox' && !String(fields[field.key] ?? '').trim());
  const goToField = key => {
    const box = formRef.current?.querySelector('[data-setup-field="' + key + '"]');
    box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box?.querySelector('input, textarea')?.focus({ preventScroll: true });
  };
  useEffect(() => { if (focused && targetField) goToField(targetField); }, [focused, targetField, showAll]);
  useEffect(() => { if (focused && targetField) setShowAll(true); }, [focused, targetField]);
  const locked = record && record.status !== 'draft';
  const run = async (action,extra = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const snapshot = JSON.stringify(fields), draft = draftRef.current;
    setBusy(true); setError(''); setNotice('');
    try { const { data } = await base44.functions.invoke('retailerSetup',{ action,store_id:store.id,step:step.key,id:draft?.id,revision:draft?.revision,fields,...extra }); if (!data || data.error) throw new Error(data?.error || 'Could not save this step.'); draftRef.current = data.record; if (['save', 'submit'].includes(action)) setSavedFields(snapshot); setNotice(action === 'save' ? 'Draft saved. You can return to it later.' : data.launch_review?.queued ? 'Step saved. All information steps are submitted; launch review is queued automatically.' : data.launch_review?.error ? 'Step saved. Automatic launch review needs a retry: ' + data.launch_review.error : 'Saved. Check the step status for review progress.'); if (action !== 'save') await onSaved({ action, step: step.key }); }
    catch(e) { setError(e?.response?.data?.error || e.message); } finally { inFlight.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!dirty || locked || blocked || busy || error) return;
    const timer = setTimeout(() => run('save'), 1200);
    return () => clearTimeout(timer);
  }, [fields, savedFields, locked, blocked, busy, error]);
  useEffect(() => {
    const warn = event => { if (dirty || inFlight.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const filledCount = step.fields.filter(field => field.type !== 'checkbox' && String(fields[field.key] ?? '').trim()).length;
  const visibleFields = showAll || locked ? step.fields : step.fields.filter(field => remainingKeys.includes(field.key) || missing.some(item => item.key === field.key));
  return <details className="rounded-xl border bg-card p-4" open={focused ?? (!record || record.status === 'needs_correction')}><summary className="min-h-11 cursor-pointer font-semibold">{step.title}<span className="ml-2 text-sm font-normal text-muted-foreground">{(record?.status || 'pending').replaceAll('_',' ')}{record ? ` · v${record.version}` : ''}</span></summary><div className="mt-3 space-y-4">
    <p className="text-sm text-muted-foreground">Your saved store details are filled in below. Review the filled details, complete the remaining boxes, then submit this step. Draft changes save automatically after you stop typing. John reviews the information before it is applied to your store. Submitting all information steps automatically sends your store for launch review.</p>
    {record?.review_note && <p className="rounded-lg bg-muted p-3 text-sm">Review: {record.review_note}</p>}
    {step.evidence && <p className="text-sm">Upload {step.evidence.replaceAll('_',' ')} under Setup documents below. Uploading alone never verifies it.</p>}
    {!locked && <div className="rounded-lg border bg-muted/30 p-3 space-y-2"><p className="text-sm font-medium">{missing.length ? missing.length + ' required boxes left' : 'Required boxes filled — review and submit'}</p>{missing.length > 0 && <><Button type="button" variant="outline" disabled={busy || blocked} onClick={() => goToField(missing[0].key)}>Next required box: {missing[0].label}</Button><div className="flex flex-wrap gap-2">{missing.map(field => <button type="button" key={field.key} disabled={busy || blocked} onClick={() => goToField(field.key)} className="min-h-11 text-sm text-primary underline">{field.label}</button>)}</div></>}<p className="text-xs text-muted-foreground">Filled boxes are saved information, not proof of verification. You can correct them before submitting.</p></div>}
    {!locked && <div className="space-y-2"><Button type="button" variant="outline" onClick={() => setShowAll(value => !value)}>{showAll ? 'Show remaining boxes only' : `Review all details (${filledCount} filled)`}</Button><p role="status" aria-live="polite" className="text-xs text-muted-foreground">{busy ? 'Saving…' : error ? 'Changes could not be saved. Correct the error or use Save draft to retry.' : dirty ? 'Changes waiting to save…' : draftRef.current ? 'Draft saved. You can return later.' : 'Known details are filled in. Changes will save automatically.'}</p></div>}
    <form ref={formRef} onSubmit={e => { e.preventDefault(); run('submit'); }} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{visibleFields.map(field => <SetupField key={field.key} field={field} value={fields[field.key]} disabled={busy || locked || blocked} onChange={value => changeField(field.key, value)} />)}</div>
      <div className="flex flex-wrap gap-2">{!locked ? <><Button type="button" variant="outline" disabled={busy || blocked} onClick={() => run('save')}>Save draft</Button><Button type="submit" disabled={busy || blocked}>{busy ? 'Saving…' : 'Submit & continue'}</Button></> : record.status !== 'submitted' && <Button type="button" variant="outline" disabled={busy || blocked} onClick={() => run('revise')}>Update this step</Button>}</div></form>
    {isAdmin && record?.status === 'submitted' && <SetupReviewControls busy={busy || blocked} testReview={step.key === 'device'} onReview={(decision,note,sandbox_test_verified) => run('review',{ decision,note,sandbox_test_verified })} />}
    {history?.length > 1 && <details><summary className="min-h-11 cursor-pointer text-sm">Previous versions ({history.length-1})</summary>{history.slice(1).map(r => <div key={r.id} className="border-t py-3 text-sm"><p>v{r.version} · {r.status.replaceAll('_',' ')} · {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'Draft'}</p><p>{r.review_note}</p><dl>{Object.entries(r.fields || {}).map(([key,value]) => <div key={key} className="break-words"><dt className="font-medium">{step.fields.find(f => f.key === key)?.label || key}</dt><dd>{String(value)}</dd></div>)}</dl></div>)}</details>}
    {notice && <p role="status" className="text-sm">{notice}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div></details>;
}