import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Clock3, ArrowUpRight } from 'lucide-react';

export default function OnboardingReadinessTask({ task }) {
  const complete = task.status === 'complete';
  const verify = task.status === 'verification';
  const Icon = complete ? CheckCircle2 : verify ? Clock3 : CircleAlert;
  return (
    <li className="border-t py-4 flex gap-3">
      <Icon aria-hidden="true" className={`w-5 h-5 mt-0.5 shrink-0 ${complete ? 'text-primary' : verify ? 'text-muted-foreground' : 'text-destructive'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-semibold">{task.label}</h3><span className={`text-xs font-medium ${complete ? 'text-primary' : verify ? 'text-muted-foreground' : 'text-destructive'}`}>{complete ? 'Complete' : verify ? 'Needs verification' : 'Missing'}</span></div>
        <p className="text-sm text-muted-foreground mt-1 break-words">{task.detail}</p>
        {!complete && <Link to={task.href} className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary underline underline-offset-4">{verify ? 'Review setup' : 'Open required step'}<ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /></Link>}
      </div>
    </li>
  );
}