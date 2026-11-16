import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import PartnerStatus from '@/components/retailers/PartnerStatus';

export default function PartnerKanbanCard({ row, onDocuments }) {
  const { store } = row;
  return <article className="min-w-0 rounded-xl border bg-card p-4 shadow-sm" aria-label={`${store.name} onboarding`}>
    <h3 className="break-words font-semibold">{store.name}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{store.city || 'City not recorded'}</p>
    {store.email && <p className="mt-1 break-all text-xs text-muted-foreground">{store.email}</p>}
    <div className="mt-4 flex items-center justify-between gap-2 text-sm"><span>Approved requirements</span><span className="font-semibold tabular-nums">{row.completed}/{row.total}</span></div>
    <Progress className="mt-2 h-2" value={row.percent} aria-label={`${store.name}: ${row.percent}% approved`} />
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Agreement</span><PartnerStatus state={row.states.signed_agreement} /></div>
    {row.reviewCount > 0 && <p className="mt-2 text-sm">{row.reviewCount} awaiting review</p>}
    {row.corrections > 0 && <p className="mt-2 text-sm text-destructive">{row.corrections} needing correction</p>}
    <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onDocuments(store.id)} aria-label={`View documents for ${store.name}`}>Documents ({row.documentItems.length})</Button><Button size="sm" asChild><Link to={`/onboarding?store_id=${encodeURIComponent(store.id)}`}>Open setup</Link></Button></div>
  </article>;
}