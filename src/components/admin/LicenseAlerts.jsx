import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
export default function LicenseAlerts() {
  const client = useQueryClient();
  const { data: alerts = [], isLoading, error } = useQuery({ queryKey: ['license-alerts'], queryFn: () => base44.entities.LicenseAlert.filter({ active: true }, '-updated_date', 500), refetchInterval: 60000 });
  useEffect(() => base44.entities.LicenseAlert.subscribe(() => client.invalidateQueries({ queryKey: ['license-alerts'] })), [client]);
  return <section className="mb-8 rounded-2xl border bg-card p-5" aria-label="Store license alerts">
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-primary" /> License Alerts {alerts.length > 0 && `(${alerts.length})`}</h2><Link to="/admin/store-compliance" className="text-sm text-primary underline">Review licenses</Link></div>
    <p className="text-sm text-muted-foreground mt-1">Pending verification and expiration warnings at 30 days, 7 days, and after expiration.</p>
    <div className="mt-4" aria-live="polite">{isLoading ? <p className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading license alerts…</p> : error ? <p className="text-sm text-destructive">Could not load license alerts.</p> : alerts.length === 0 ? <p className="text-sm text-muted-foreground">No active license alerts. Expiration checks require a recorded expiration date.</p> : <ul className="max-h-80 overflow-y-auto divide-y">{alerts.map(a => <li key={a.id} className="py-3"><Link to={`/onboarding?store_id=${encodeURIComponent(a.store_id)}`} className="font-medium text-sm text-primary underline">{a.store_name}</Link><p className="text-sm mt-1">{a.message}</p><p className="text-xs text-muted-foreground mt-1">{a.email_sent_at ? 'Email notification sent' : 'Email notification pending'}</p></li>)}</ul>}</div>
  </section>;
}