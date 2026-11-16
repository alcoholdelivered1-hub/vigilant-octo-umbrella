import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import useStorefrontProgress from '@/components/stores/useStorefrontProgress';
import StorefrontReadinessChecklist from '@/components/stores/StorefrontReadinessChecklist';

const stages = { pending: 'Setup not yet submitted', invited: 'Retailer invited', contract_sent: 'Agreement sent', contract_signed: 'Agreement recorded', inventory_added: 'Inventory added', live: 'Recorded live' };
export default function StorefrontLaunchProgress({ store, isStoreLive }) {
  const query = useStorefrontProgress(store);
  const checks = query.data?.checks || [];
  const completed = checks.filter(check => check.status === 'complete').length;
  const percent = checks.length ? Math.round(completed / checks.length * 100) : 0;
  const setupUrl = `/onboarding?store_id=${encodeURIComponent(store.id)}`;
  const returnTo = `/stores/${encodeURIComponent(store.id)}`;
  return (
    <section className="my-6 rounded-2xl border bg-card p-4 sm:p-6 space-y-4" aria-label={`${store.name} go-live progress`} aria-busy={query.isFetching}>
      <header className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Go-live progress</h2><p className="mt-1 text-sm text-muted-foreground">{isStoreLive ? 'Ordering enabled' : 'Storefront preview · Ordering not yet enabled'} · {stages[query.data?.stage || store.onboarding_status] || 'Setup in progress'}</p></div>{query.canView && <Button type="button" size="icon" variant="outline" aria-label="Refresh go-live progress" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button>}</header>
      {!query.canView ? <p className="text-sm text-muted-foreground">Detailed readiness is visible to this retailer’s team and administrators. {!query.signedIn && <Link to={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-primary underline underline-offset-4">Retailer sign in</Link>}</p> : query.isLoading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking saved launch requirements…</p> : query.isError ? <p role="alert" className="text-sm text-destructive">Progress could not be updated. Refresh to try again; no readiness is assumed.</p> : query.data && <>
        <div className="flex items-center justify-between gap-3 text-sm"><span>{completed} of {checks.length} requirements complete</span><span className="font-semibold tabular-nums">{percent}%</span></div>
        <Progress value={percent} aria-label={`${percent}% of recorded go-live requirements complete`} />
        <StorefrontReadinessChecklist checks={checks} setupUrl={setupUrl} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Updated {new Date(query.data.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })} · Refreshes every minute while viewing</span><Link to={setupUrl} className="text-primary underline underline-offset-4">Continue retailer setup</Link></div>
        <p className="text-xs text-muted-foreground">Read-only readiness, not launch approval. Saved payment connections still need final verification; completing this checklist never activates the store.</p>
      </>}
    </section>
  );
}