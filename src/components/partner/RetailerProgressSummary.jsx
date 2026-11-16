import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import useRetailerProgressSummary from '@/components/partner/useRetailerProgressSummary';

export default function RetailerProgressSummary({ stores }) {
  const query = useRetailerProgressSummary(stores);
  const rows = query.data || [];
  const incomplete = rows.some(row => row.percent === null);
  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-6 space-y-4" aria-labelledby="retailer-progress-heading" aria-busy={query.isFetching}>
      <header className="flex items-start justify-between gap-3">
        <div><h2 id="retailer-progress-heading" className="text-lg font-semibold">Store onboarding progress</h2><p className="text-sm text-muted-foreground">Completed launch requirements, ranked highest first across all {stores.length} stores.</p></div>
        <Button size="icon" variant="outline" aria-label="Refresh store progress" disabled={query.isFetching || !stores.length} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>
      </header>
      {!stores.length ? <p className="text-sm text-muted-foreground">No stores to display yet.</p> : query.isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading store progress…</p> : query.isError ? <p role="alert" className="text-sm text-destructive">Could not load progress. Use refresh to try again.</p> : (
        <ul className="space-y-4" aria-label="Store onboarding percentage chart">
          {rows.map(row => <li key={row.id} className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
            <div className="min-w-0"><p className="text-sm font-medium break-words">{row.name}</p><p className="text-xs text-muted-foreground">{row.percent === null ? 'Progress unavailable' : `${row.completed} of ${row.total} complete${row.live ? ' · Recorded Live' : ''}`}</p></div>
            {row.percent === null ? <span className="text-sm text-muted-foreground">—</span> : <div className="flex items-center gap-3"><Progress value={row.percent} aria-label={`${row.name}: ${row.percent}% of launch requirements complete`} className="h-3 flex-1" /><span className="w-12 text-right text-sm font-semibold tabular-nums">{row.percent}%</span></div>}
          </li>)}
        </ul>
      )}
      {incomplete && <p role="status" className="text-sm text-destructive">Some stores could not be checked; refresh to retry. Unavailable progress is not counted as zero.</p>}
      <p className="text-xs text-muted-foreground">Read-only checklist progress, not launch approval. Payment and webhook verification remain incomplete until verified; saved Live status does not override missing requirements.</p>
    </section>
  );
}