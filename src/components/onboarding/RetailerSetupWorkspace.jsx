import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SetupStepEditor from './SetupStepEditor';
import StoreSetupDocuments from './StoreSetupDocuments';
import SetupConnections from './SetupConnections';
import SetupLaunchReview from './SetupLaunchReview';
import RetailerDirectContact from '@/components/partner/RetailerDirectContact';
import AppInstallCard from '@/components/shared/AppInstallCard';
import { retailerProgress } from './retailerProgress';

const labels = { business: 'Store details', license: 'Retail license', operations: 'Hours & pickup', pos: 'Register & inventory source', inventory: 'Products & prices', device: 'Tablet & order test' };
const statusLabel = record => record?.status === 'approved' ? 'Approved' : record?.status === 'submitted' ? 'Submitted — waiting for review' : record?.status === 'needs_correction' ? 'Needs a correction' : record?.status === 'draft' ? 'Draft saved' : 'To do';

export default function RetailerSetupWorkspace({ data, onSaved, onDraftStateChanged }) {
  const [paymentReady, setPaymentReady] = useState(false);
  const { nextPanel, stages, agreementSubmitted, completed } = retailerProgress(data, paymentReady);
  const progressRef = useRef(null);
  const [savedNotice, setSavedNotice] = useState('');
  const [pendingDrafts, setPendingDrafts] = useState({});
  const draftPending = Object.values(pendingDrafts).some(Boolean);
  useEffect(() => { onDraftStateChanged?.(draftPending); }, [draftPending, onDraftStateChanged]);
  const onDraftPending = (key, value) => setPendingDrafts(current => current[key] === value ? current : { ...current, [key]: value });
  const latest = key => data.submissions.find(item => item.step === key);
  const actionSteps = data.steps.filter(step => !latest(step.key) || ['draft', 'needs_correction'].includes(latest(step.key).status));
  const stepSaved = async ({ action, step } = {}) => {
    const refreshed = await onSaved();
    if (refreshed?.error) throw new Error('Your step was saved, but progress could not refresh. Select Refresh progress before continuing.');
    if (refreshed?.data && ['submit', 'review'].includes(action)) {
      setSavedNotice((labels[step] || 'Step') + ' saved. Moving to your next task.');
      setPanel(retailerProgress(refreshed.data, paymentReady).nextPanel, true);
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return refreshed;
  };
  const [params, setParams] = useSearchParams();
  const requested = params.get('step');
  const validPanels = [...data.steps.map(step => step.key), 'agreement', 'connections', 'launch'];
  const [panel, setPanelState] = useState(validPanels.includes(requested) ? requested : nextPanel);
  const setPanel = (key, savedSubmission = false) => {
    if (draftPending && !savedSubmission) return;
    setPanelState(key);
    const next = new URLSearchParams(params);
    next.set('store_id', data.store.id);
    next.set('step', key);
    next.delete('field');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (paymentReady && panel === 'connections' && !draftPending && !data.ambiguity.length) {
      setSavedNotice('Payments and payouts verified. Moving to your next task.');
      setPanel(nextPanel, true);
      progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [paymentReady, panel, draftPending, nextPanel, data.ambiguity.length]);
  const blocked = !!data.ambiguity.length;
  const approved = data.steps.filter(step => data.submissions.find(item => item.step === step.key)?.status === 'approved').length;
  const panels = [...data.steps.map(step => ({ key: step.key, label: labels[step.key] || step.title, note: statusLabel(data.submissions.find(item => item.step === step.key)) })),
    { key: 'agreement', label: 'Partner agreement', note: agreementSubmitted ? 'Signed copy saved — view review status' : 'Review and sign' },
    { key: 'connections', label: 'Payments & notifications', note: paymentReady ? 'Payments and payouts verified' : 'Connect and check' },
    { key: 'launch', label: 'Final launch review', note: data.store.is_active && data.store.onboarding_status === 'live' ? 'Recorded live' : 'Review before ordering opens' }];

  const stageIndex = Math.max(0, stages.findIndex(stage => stage.keys.includes(panel)));
  const visiblePanels = panels.filter(item => stages[stageIndex].keys.includes(item.key));
  const openStage = stage => setPanel(stage.keys.find(key => actionSteps.some(step => step.key === key)) || stage.keys.find(key => ['agreement', 'connections', 'launch'].includes(key)) || stage.keys[0]);
  return <div className="space-y-5">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div><h2 className="font-semibold">{data.store.name}</h2><p className="text-sm text-muted-foreground">{approved} of {data.steps.length} information steps approved</p></div>
      <Button asChild variant="outline"><Link to={'/store/dashboard?store_id=' + encodeURIComponent(data.store.id)}>Open store orders</Link></Button>
    </section>
    <section ref={progressRef} className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      {savedNotice && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />{savedNotice}</p>}
      <p className="text-sm">{data.steps.filter(step => completed[step.key]).length} of {data.steps.length} information steps submitted. Green checks mean your step is saved; John’s approval is shown separately.</p>
      <h2 className="font-semibold">{actionSteps.length ? `${actionSteps.length} information steps need your attention` : 'Your information has been submitted'}</h2>
      <p className="text-sm text-muted-foreground">{actionSteps.length ? 'Review the details we already have and fill the remaining boxes. Submitted steps are saved below.' : 'John reviews submitted information. You can check your agreement, connect payments and set up order alerts while review continues.'}</p>
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={blocked || draftPending} onClick={() => setPanel(nextPanel)}>{'Continue: ' + (labels[nextPanel] || ({ agreement: 'Review agreement', connections: 'Get paid', launch: 'Launch review' })[nextPanel])}</Button><Button type="button" variant="outline" disabled={blocked || draftPending} onClick={() => setPanel('connections')}>Finish payment setup</Button><Button type="button" variant="outline" disabled={blocked || draftPending} onClick={() => setPanel('launch')}>See what is blocking launch</Button></div>
    </section>
    {draftPending && <p role="status" className="text-sm">Save this draft before changing steps. If saving fails, correct the error or select Save draft to retry.</p>}
    <p className="text-sm text-muted-foreground">You can pause and return later. Complete only the items still needed; saved submissions stay available. Need help? Call John below.</p><RetailerDirectContact />
    {blocked && <p role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">{data.ambiguity.join(' ')} Contact John to resolve this store's records.</p>}
    <nav aria-label="Three onboarding stages" className="grid gap-3 sm:grid-cols-3">
      {stages.map((stage, index) => <button key={stage.label} type="button" disabled={draftPending || blocked} onClick={() => openStage(stage)} aria-current={stageIndex === index ? 'step' : undefined} className={cn('min-h-24 rounded-xl border p-4 text-left', stageIndex === index ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted')}>
        <span className="flex items-center gap-2 text-sm font-semibold">{stage.completed && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Stage submitted" />}{index + 1}. {stage.label}</span>
        <span className="mt-2 block text-xs text-muted-foreground">{stage.description}</span>
        <span className="mt-2 block text-xs font-medium">{stage.note}</span>
      </button>)}
    </nav>
    <div className="grid items-start gap-5 md:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Retailer setup checklist" className="grid grid-cols-2 gap-2 md:grid-cols-1">{visiblePanels.map((item) => <button key={item.key} type="button" disabled={draftPending} onClick={() => setPanel(item.key)} aria-current={panel === item.key ? 'step' : undefined} aria-controls={'setup-panel-' + item.key}
        className={cn('min-h-14 rounded-xl border p-3 text-left text-sm', panel === item.key ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted')}>
        <span className="flex items-center gap-2 font-semibold">{completed[item.key] && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Step completed" />}{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.note}</span>
      </button>)}</nav>
      <div className="min-w-0 space-y-4">
        {data.steps.map(step => {
          const history = data.submissions.filter(item => item.step === step.key), record = history[0];
          return <section key={step.key} id={'setup-panel-' + step.key} hidden={panel !== step.key} aria-label={labels[step.key] || step.title}>
            <SetupStepEditor key={step.key + '-' + (record?.id || 'new') + '-' + (record?.revision || 0) + '-' + (record?.status || '')} onDraftPending={onDraftPending} focused={panel === step.key} targetField={panel === step.key ? params.get('field') : null} step={step} store={data.store} record={record} history={history} blocked={blocked} isAdmin={data.is_admin} onSaved={stepSaved} />
          </section>;
        })}
        <section id="setup-panel-agreement" hidden={panel !== 'agreement'} className="space-y-3 rounded-xl border bg-card p-4" aria-label="Partner agreement">
          <h2 className="font-semibold">Partner agreement</h2><p className="text-sm">{data.agreements[0] ? data.agreements[0].status + ' · ' + (data.agreements[0].review_status || 'Review pending') : agreementSubmitted ? 'Your signed agreement copy is saved for review.' : 'An agreement needs to be reviewed and signed.'}</p>
          <p className="text-sm text-muted-foreground">Check the existing agreement before starting a new version. Contact John if its terms need clarification.</p>
          <Button asChild><Link to={'/retailer-contract?store_id=' + encodeURIComponent(data.store.id)}>{data.is_admin ? 'Review & countersign' : agreementSubmitted ? 'View saved agreement' : 'Review & sign agreement'}</Link></Button>
        </section>
        <section id="setup-panel-connections" hidden={panel !== 'connections'} aria-label="Payments and notifications">{panel === 'connections' && <SetupConnections store={data.store} blocked={blocked} onPaymentReady={setPaymentReady} />}</section>
        {panel === 'connections' && paymentReady && <Button type="button" disabled={draftPending || blocked} onClick={() => setPanel(nextPanel)}>Payments verified — continue to products & pickup</Button>}
        <section id="setup-panel-launch" hidden={panel !== 'launch'} aria-label="Final launch review">{panel === 'launch' && <SetupLaunchReview data={data} onSaved={onSaved} />}</section>
        <p className="text-xs text-muted-foreground">Draft changes save automatically. Wait for “Draft saved” before leaving. Submitted steps stay saved while John reviews them.</p>
        <details className="rounded-xl border bg-card p-4" open={data.steps.some(step => step.key === panel && step.evidence)}><summary className="min-h-11 cursor-pointer font-semibold">Upload or view documents</summary><div className="mt-3"><StoreSetupDocuments store={data.store} data={data} onChanged={onSaved} /></div></details>
      </div>
    </div>
    <details className="rounded-xl border bg-card p-4"><summary className="min-h-11 cursor-pointer text-sm font-semibold">Add the app to your phone or tablet</summary><AppInstallCard /></details>
  </div>;
}
