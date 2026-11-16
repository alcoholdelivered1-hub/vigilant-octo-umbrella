import React from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import BKTaxEvidence from '@/components/admin/BKTaxEvidence';
import BKDriverEvidence from '@/components/admin/BKDriverEvidence';
import BKTestEvidence from '@/components/admin/BKTestEvidence';

export default function BKLaunchAdminSteps({ result, onComplete }) {
  const queryClient = useQueryClient();
  const complete = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bk-launch-justin'] });
    await onComplete();
  };
  if (!result || result.ready) return null;
  return <section className="space-y-4" aria-labelledby="launch-team-title">
    <h2 id="launch-team-title" className="text-lg font-semibold">Alcohol Delivered launch responsibilities</h2>
    <p className="text-sm text-muted-foreground">These must also pass before ordering opens. Mr. Singh’s authorizations do not replace tax review, real driver clearance or the sandbox launch test.</p>
    {result.is_admin ? <>
      {!result.checks.tax_confirmation_recorded && <BKTaxEvidence onComplete={complete} />}
      {!result.checks.available_driver_with_push && <BKDriverEvidence onComplete={complete} />}
      {!result.checks.test_order_passed && <BKTestEvidence onComplete={complete} />}
    </> : <p className="rounded-xl border bg-card p-4 text-sm">The Alcohol Delivered admin must record the outstanding tax review, driver clearance and sandbox test. This page will show their verified status when refreshed.</p>}
    <div className="flex flex-wrap gap-4 text-sm">
      <Link className="text-primary underline" to="/store/dashboard">Store tablet notifications</Link>
      {result.is_admin && <Link className="text-primary underline" to="/admin/drivers">Driver availability and training</Link>}
      <Link className="text-primary underline" to="/driver">Driver portal and notifications</Link>
    </div>
  </section>;
}