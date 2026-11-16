import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import PartnerStatus from '@/components/retailers/PartnerStatus';
import { documentKinds } from '@/components/retailers/partnerProgress';
export default function PartnerOverviewRow({ row, onDocuments }) {
  const { store } = row;
  return <article className="grid items-start gap-5 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,2fr)_auto]" aria-label={`${store.name} onboarding status`}>
    <div className="min-w-0"><h3 className="font-semibold break-words">{store.name}</h3><p className="mt-1 text-sm text-muted-foreground">{store.city || 'City not recorded'}</p><p className="mt-2 inline-block rounded-md bg-muted px-2 py-1 text-xs font-medium">{store.onboarding_status === 'live' ? 'Recorded live' : (store.onboarding_status || 'invited').replaceAll('_', ' ')}</p>{row.updated && <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(row.updated).toLocaleDateString()}</p>}</div>
    <div><div className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold tabular-nums">{row.percent}%</span><span className="text-muted-foreground">{row.completed}/{row.total}</span></div><Progress className="mt-2 h-2" value={row.percent} aria-label={`${store.name}: ${row.completed} of ${row.total} onboarding requirements approved`} /><p className="mt-2 text-xs text-muted-foreground">Approved requirements</p>{row.reviewCount > 0 && <p className="mt-2 text-sm font-medium">{row.reviewCount} awaiting review</p>}</div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-3">{documentKinds.map(([kind,label]) => <div key={kind} className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd><PartnerStatus state={row.states[kind]} /></dd></div>)}</dl>
    <div className="flex flex-wrap gap-2 lg:flex-col"><Button size="sm" variant="outline" onClick={() => onDocuments(row.store.id)} aria-label={`View documents for ${store.name}`}>Documents ({row.documentItems.length})</Button><Button size="sm" asChild><Link to={`/onboarding?store_id=${encodeURIComponent(store.id)}`}>Open setup</Link></Button></div>
  </article>;
}