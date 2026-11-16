import React from 'react';
import useRetailerLaunchPreviews from '@/components/partner/useRetailerLaunchPreviews';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw } from 'lucide-react';
import OnboardingReadinessTask from '@/components/admin/OnboardingReadinessTask';
import LaunchNextAction from '@/components/admin/LaunchNextAction';

export default function StoreOnboardingReadiness({ storeId, name, refreshVersion, focus = false, viewerId = '' }) {
  const query = useRetailerLaunchPreviews(refreshVersion, storeId);
  const data = query.data;
  const done = data?.checks.filter(t => t.status === 'complete').length || 0;
  const missing = data?.checks.filter(t => t.status === 'missing').length || 0;
  const verification = data?.checks.filter(t => t.status === 'verification').length || 0;
  const total = data?.checks.length || 0;
  const ordered = data ? [...data.checks].sort((a, b) => ({ missing: 0, verification: 1, complete: 2 }[a.status] - { missing: 0, verification: 1, complete: 2 }[b.status])) : [];
  return (
    <section className="bg-card border rounded-2xl p-5 sm:p-6 min-w-0" aria-label={`${name} onboarding`}>
      <header className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl font-semibold">{name}</h2>{data && <p className="text-sm text-muted-foreground mt-1">{data.city} · Stage: {data.stage.replaceAll('_', ' ')}</p>}</div><Button size="icon" variant="ghost" aria-label={`Refresh ${name}`} onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} /></Button></header>
      {query.isLoading ? <p className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading launch requirements…</p> : query.isError ? <div className="py-8 space-y-3" role="alert"><p className="text-destructive">{query.error.response?.data?.error || query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div> : <>
        <div className="my-5 space-y-3"><div className="flex justify-between text-sm"><span className="font-semibold">{done} of {total} requirements complete</span><span>{Math.round(done / total * 100)}%</span></div><Progress value={done / total * 100} aria-label={`${name} onboarding progress`} /><p className="text-sm"><span className="font-medium text-destructive">{missing} missing</span><span className="text-muted-foreground"> · {verification} need verification · {data.live ? (missing ? 'Saved Live status — launch blockers remain' : 'Saved Live status — final verification still required') : 'Not live yet'}</span></p></div>
        {focus && <LaunchNextAction data={data} />}
        <div className="flex flex-wrap gap-2 mb-5"><Button asChild size="sm"><Link to={`/onboarding?store_id=${storeId}`}>Open onboarding</Link></Button><Button asChild size="sm" variant="outline"><Link to={`/stores/${storeId}`}>View storefront</Link></Button></div>
        <p className="text-xs text-muted-foreground mb-3">Updated {new Date(data.checked_at).toLocaleString()} · Missing items shown first</p>
        {focus ? <><details open><summary className="cursor-pointer py-2 text-sm font-semibold">Remaining requirements ({missing + verification})</summary><ul>{ordered.filter(task => task.status !== 'complete').map(task => <OnboardingReadinessTask key={task.key} task={task} />)}</ul></details><details><summary className="cursor-pointer py-2 text-sm font-semibold">Already completed ({done})</summary><ul>{ordered.filter(task => task.status === 'complete').map(task => <OnboardingReadinessTask key={task.key} task={task} />)}</ul></details></> : <ul>{ordered.map(task => <OnboardingReadinessTask key={task.key} task={task} />)}</ul>}
      </>}
    </section>
  );
}