import React from 'react';
import { Store, CheckCircle2, Clock, FileText } from 'lucide-react';
export default function PartnerOverviewSummary({ rows }) {
  const stats = [
    { label: 'Retailer partners', value: rows.length, Icon: Store, note: 'All partnered stores' },
    { label: 'Onboarding approved', value: rows.filter(row => row.completed === row.total).length, Icon: CheckCircle2, note: '8 reviewed requirements; not activation' },
    { label: 'Awaiting review', value: rows.reduce((sum,row) => sum + row.reviewCount,0), Icon: Clock, note: 'Documents, agreements and setup steps' },
    { label: 'Missing documents', value: rows.reduce((sum,row) => sum + row.missing,0), Icon: FileText, note: 'License, agreement and inventory export' }
  ];
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(({ label,value,Icon,note }) => <div key={label} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{label}</p><Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /></div><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>)}</div>;
}