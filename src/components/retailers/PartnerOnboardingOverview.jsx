import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import usePartnerOverview from '@/components/retailers/usePartnerOverview';
import PartnerOverviewSummary from '@/components/retailers/PartnerOverviewSummary';
import PartnerOverviewFilters from '@/components/retailers/PartnerOverviewFilters';
import PartnerOverviewRow from '@/components/retailers/PartnerOverviewRow';
import PartnerDocumentsDialog from '@/components/retailers/PartnerDocumentsDialog';
export default function PartnerOnboardingOverview() {
  const { user } = useAuth();
  const query = usePartnerOverview(user);
  const [search,setSearch] = useState(''), [stage,setStage] = useState('all'), [documents,setDocuments] = useState('all'), [selected,setSelected] = useState('');
  if (user?.role !== 'admin') return <p className="text-muted-foreground">Sign in as an administrator to view all retailer partners.</p>;
  if (query.isLoading) return <p role="status" className="py-10 text-muted-foreground">Loading saved onboarding progress and documents…</p>;
  const rows = query.data || [];
  const term = search.trim().toLowerCase();
  const visible = rows.filter(row => [row.store.name,row.store.city,row.store.email].some(value => String(value || '').toLowerCase().includes(term)) && (stage === 'all' || (row.store.onboarding_status || 'invited') === stage) && (documents === 'all' || documents === 'missing' && row.missing > 0 || documents === 'review' && row.reviewCount > 0 || documents === 'corrections' && row.corrections > 0));
  const selectedRow = rows.find(row => row.store.id === selected);
  return <section className="space-y-5" aria-label="All retailer onboarding and documents" aria-busy={query.isFetching}>
    {query.isError && <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-4"><p className="text-sm text-destructive">Could not refresh retailer progress and document records.{query.data ? ' Showing the last loaded records.' : ''}</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Try again</Button></div>}
    {query.data && <><PartnerOverviewSummary rows={rows} />
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm text-muted-foreground">Latest document versions and reviewed setup steps across all partners. Recorded live status is not proof of launch readiness; this dashboard never activates a store.</p><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh</Button></div>
      <PartnerOverviewFilters search={search} onSearch={setSearch} stage={stage} onStage={setStage} documents={documents} onDocuments={setDocuments} />
      <p role="status" className="text-sm text-muted-foreground">Showing {visible.length} of {rows.length} partners · Updates automatically as saved records change</p>
      {visible.length ? <div className="space-y-3">{visible.map(row => <PartnerOverviewRow key={row.store.id} row={row} onDocuments={setSelected} />)}</div> : <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">{rows.length ? 'No partners match these filters.' : 'No retailer partners have been added yet.'}</p>}
      {selectedRow && <PartnerDocumentsDialog key={selectedRow.store.id} row={selectedRow} onClose={() => setSelected('')} />}
    </>}
  </section>;
}