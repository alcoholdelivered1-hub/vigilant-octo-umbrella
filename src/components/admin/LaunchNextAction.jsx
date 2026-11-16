import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const ORDER = ['profile', 'compliance', 'license', 'agreement', 'inventory', 'payment', 'tax', 'operations', 'abc', 'city', 'driver', 'zone', 'test', 'webhook'];
export default function LaunchNextAction({ data }) {
  const remaining = data.checks.filter(check => check.status !== 'complete');
  const next = [...remaining].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key))[0];
  const beverage = /beverage king/i.test(data.store_name);
  return <div className="rounded-xl bg-muted/50 border p-4 space-y-3 mb-5">
    <p className="text-sm font-semibold">Your next action</p>
    {next ? <><p className="font-medium">{next.label}</p><p className="text-sm text-muted-foreground">{next.detail}</p><Button asChild size="sm"><Link to={next.href}>{next.status === 'verification' ? 'Review this requirement' : 'Complete this step'}</Link></Button></> : <p className="text-sm">Saved checklist complete. Finish the final launch review before accepting orders.</p>}
    <p className="text-xs text-muted-foreground">Completion comes from saved evidence, not manual checkmarks. Updates appear here automatically.</p>
    {beverage && <p className="text-sm text-muted-foreground">Beverage King also needs its merchant-specific Clover, payment, and notification checks.</p>}
    <Link className="block text-sm text-primary underline underline-offset-4" to={beverage ? '/admin/beverage-king-golive' : `/onboarding?store_id=${encodeURIComponent(data.store_id)}`}>Open final launch review</Link>
  </div>;
}