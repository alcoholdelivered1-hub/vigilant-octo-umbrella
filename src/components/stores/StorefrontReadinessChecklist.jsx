import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Circle } from 'lucide-react';

const statusLabels = { complete: 'Complete', verification: 'Verification required', missing: 'Action needed' };
export default function StorefrontReadinessChecklist({ checks, setupUrl }) {
  const next = checks.find(check => check.status !== 'complete');
  return (
    <div className="space-y-3">
      {next && <p className="text-sm"><span className="font-semibold">Next requirement: </span>{next.detail} <Link to={setupUrl} className="text-primary underline underline-offset-4">Open retailer setup</Link></p>}
      <details className="rounded-xl border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">View go-live checklist ({checks.length} requirements)</summary>
        <ul className="divide-y border-t">
          {checks.map(check => {
            const Icon = check.status === 'complete' ? CheckCircle2 : check.status === 'verification' ? Clock : Circle;
            return <li key={check.key} className="flex items-start gap-3 px-4 py-3 text-sm">
              <Icon aria-hidden="true" className={check.status === 'complete' ? 'mt-0.5 h-4 w-4 shrink-0 text-primary' : 'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground'} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{check.label}</span><span className="text-xs text-muted-foreground">{statusLabels[check.status] || 'Pending review'}</span></div><p className="mt-1 break-words text-muted-foreground">{check.detail}</p></div>
            </li>;
          })}
        </ul>
      </details>
    </div>
  );
}