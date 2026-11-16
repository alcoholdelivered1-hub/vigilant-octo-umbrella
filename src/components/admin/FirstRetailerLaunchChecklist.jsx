import React from 'react';
import StoreOnboardingReadiness from '@/components/admin/StoreOnboardingReadiness';
import useLaunchFocus from '@/components/admin/useLaunchFocus';

export default function FirstRetailerLaunchChecklist({ stores, refreshVersion }) {
  const { focus, loading, failures, compared } = useLaunchFocus(stores, refreshVersion);
  const reviewed = focus.filter(item => item.data);
  const best = [...reviewed].sort((a, b) => a.data.checks.filter(c => c.status !== 'complete').length - b.data.checks.filter(c => c.status !== 'complete').length)[0];
  const closest = focus.find(item => !/beverage king|colonial wines/i.test(item.store.name));
  return <section className="space-y-5" aria-label="First retailer launch checklist">
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <h2 className="font-display text-2xl font-semibold">Goal: one fully verified retailer live</h2>
      <p className="text-sm text-muted-foreground">Track Beverage King, Colonial Wines &amp; Spirits, and the closest-to-ready alternative together. Expand “Already completed” to see the work on file; remaining requirements and your next action stay visible.</p>
      {loading ? <p className="text-sm" role="status">Comparing launch evidence across all retailers…</p> : <p className="text-sm">Compared {compared} retailers. {closest ? `Alternative: ${closest.store.name}, selected by fewest incomplete requirements; ties are alphabetical.` : 'No additional retailer is available for comparison.'}</p>}
      {!loading && best && <p className="text-sm font-semibold">Start with {best.store.name}: {best.data.checks.filter(c => c.status !== 'complete').length} requirements still need attention.</p>}
      {failures > 0 && <p role="alert" className="text-sm text-destructive">{failures} retailer checks could not load. The comparison includes only successfully reviewed retailers; use Refresh all retailers to retry.</p>}
      <p className="text-sm text-muted-foreground">A saved “Live” label is not proof of launch readiness. This checklist does not clear missing evidence, activate stores, or run live payment checks.</p>
    </div>
    <div className="grid xl:grid-cols-3 gap-5 items-start">{focus.map(({ store }) => <StoreOnboardingReadiness key={store.id} storeId={store.id} name={store.name} refreshVersion={refreshVersion} focus />)}</div>
  </section>;
}