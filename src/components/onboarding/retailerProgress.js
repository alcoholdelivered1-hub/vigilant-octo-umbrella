export const retailerStages = [
  { label: 'Store details & agreement', keys: ['business', 'license', 'agreement'], description: 'Confirm saved details, your license and agreement.' },
  { label: 'Get paid', keys: ['connections'], description: 'Complete the secure Stripe form. John handles account connection problems.' },
  { label: 'Products & pickup', keys: ['operations', 'pos', 'inventory', 'device', 'launch'], description: 'Confirm products, hours and alerts with John’s help.' },
];
export function retailerProgress(data, paymentReady = false) {
  const latest = key => data.submissions.find(item => item.step === key);
  const needsAction = key => !latest(key) || ['draft', 'needs_correction'].includes(latest(key).status);
  const agreement = data.agreements[0];
  const document = data.documents.find(item => item.kind === 'signed_agreement');
  const agreementSubmitted = agreement
    ? agreement.status === 'submitted' && agreement.review_status !== 'needs_correction'
    : !!document && ['pending_review', 'approved'].includes(document.status);
  const keys = data.steps.map(step => step.key);
  const beforePayment = ['business', 'license'].find(key => keys.includes(key) && needsAction(key));
  const afterPayment = ['operations', 'pos', 'inventory', 'device'].find(key => keys.includes(key) && needsAction(key));
  const nextPanel = beforePayment || (!agreementSubmitted ? 'agreement' : !paymentReady ? 'connections' : afterPayment || 'launch');
  const completed = Object.fromEntries(keys.map(key => [key, ['submitted', 'approved'].includes(latest(key)?.status)]));
  completed.agreement = agreementSubmitted;
  completed.connections = paymentReady;
  completed.launch = !!(data.store?.is_active && data.store?.onboarding_status === 'live') || ['submitted', 'approved'].includes(latest('launch')?.status);
  const stages = retailerStages.map(stage => {
    const pending = stage.keys.filter(key => keys.includes(key) && needsAction(key));
    const reviewing = stage.keys.filter(key => latest(key)?.status === 'submitted').length;
    const note = stage.keys.includes('connections')
      ? paymentReady ? 'Payments and payouts verified' : 'Check secure payment setup'
      : pending.length ? pending.length + (pending.length === 1 ? ' item needs your attention' : ' items need your attention')
      : stage.keys.includes('agreement') && !agreementSubmitted ? 'Agreement needs your attention'
      : reviewing ? 'Saved — waiting for John’s review'
      : stage.keys.includes('launch') ? 'John handles final launch review'
      : 'Information saved';
    return { ...stage, note, completed: stage.keys.filter(key => keys.includes(key) || ['agreement', 'connections', 'launch'].includes(key)).every(key => completed[key]) };
  });
  return { nextPanel, stages, agreementSubmitted, completed };
}
