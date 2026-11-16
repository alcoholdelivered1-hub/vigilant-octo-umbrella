import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, FileText } from 'lucide-react';
const styles = { approved: 'border-primary/20 bg-primary/10 text-primary', pending_review: 'border-secondary/30 bg-secondary/10 text-foreground', submitted: 'border-secondary/30 bg-secondary/10 text-foreground', needs_correction: 'border-destructive/30 bg-destructive/10 text-destructive', expired: 'border-destructive/30 bg-destructive/10 text-destructive', countersign: 'border-secondary/30 bg-secondary/10 text-foreground' };
export default function PartnerStatus({ state }) {
  const Icon = state.status === 'approved' ? CheckCircle2 : ['pending_review', 'submitted', 'countersign'].includes(state.status) ? Clock : ['needs_correction', 'expired'].includes(state.status) ? AlertTriangle : FileText;
  return <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${styles[state.status] || 'border-border bg-muted text-muted-foreground'}`}><Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{state.label}</span>;
}