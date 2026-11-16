import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

const STATUS_META = {
  done: { icon: CheckCircle2, color: 'text-emerald-600', ring: 'border-emerald-200 bg-emerald-50/40' },
  pending: { icon: Circle, color: 'text-muted-foreground', ring: 'border-border bg-card' },
  loading: { icon: Loader2, color: 'text-muted-foreground', ring: 'border-border bg-card' },
};

export default function OnboardingStep({ index, title, status = 'pending', subtitle, children }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <div className={`rounded-2xl border p-5 ${meta.ring}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <span className="text-xs font-semibold text-muted-foreground">{index}</span>
          <Icon className={`w-5 h-5 mt-0.5 ${meta.color} ${status === 'loading' ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-sm">{title}</h3>
            <span className={`text-xs font-medium uppercase tracking-wide ${meta.color}`}>
              {status === 'done' ? 'Complete' : status === 'loading' ? 'Checking' : 'Pending'}
            </span>
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}