import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import usePartnerOverview from '@/components/retailers/usePartnerOverview';
import PartnerKanbanCard from '@/components/retailers/PartnerKanbanCard';
import PartnerDocumentsDialog from '@/components/retailers/PartnerDocumentsDialog';

const columns = [
  { key: 'progress', title: 'In progress', description: 'Setup, documents and approvals underway.' },
  { key: 'signature', title: 'Pending signature', description: 'Agreement requested, not yet signed and submitted.' },
  { key: 'active', title: 'Fully activated', description: 'Recorded live and active.' },
];
const stageFor = row => {
  const { store } = row;
  if (store.onboarding_status === 'live' && store.is_active === true) return 'active';
  const signed = row.contract?.status === 'submitted' || row.states.signed_agreement.collected || ['contract_signed', 'inventory_added', 'live'].includes(store.onboarding_status);
  const requested = Boolean(store.contract_sent_at || store.onboarding_status === 'contract_sent' || row.contract?.status === 'draft');
  return requested && !signed ? 'signature' : 'progress';
};

export default function PartnerKanbanBoard() {
  const { user } = useAuth();
  const query = usePartnerOverview(user);
  const [search, setSearch] = useState(''), [selected, setSelected] = useState('');
  if (user?.role !== 'admin') return <p>Sign in as an administrator to view retailer onboarding.</p>;
  if (query.isLoading) return <p role="status" className="py-10 text-muted-foreground">Loading retailer onboarding board…</p>;
  const rows = query.data || [], term = search.trim().toLowerCase();
  const visible = rows.filter(row => [row.store.name, row.store.city, row.store.email].some(value => String(value || '').toLowerCase().includes(term)));
  const selectedRow = rows.find(row => row.store.id === selected);
  return <section className="space-y-5" aria-label="Retailer onboarding kanban board" aria-busy={query.isFetching}>
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="w-full max-w-sm text-sm font-medium">Search retailers<Input className="mt-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="Store, city or email" /></label><Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />Refresh</Button></div>
    <p className="text-sm text-muted-foreground">Updates automatically as saved records change. This board displays recorded onboarding status; it does not activate stores or verify live payment readiness.</p>
    {query.isError && <p role="alert" className="text-destructive">Could not refresh the board.{query.data ? ' Showing the last loaded records.' : ' Use Refresh to try again.'}</p>}
    {query.data && <><p role="status" className="text-sm text-muted-foreground">Showing {visible.length} of {rows.length} retailers</p><div className="grid items-start gap-4 md:grid-cols-3">{columns.map(column => {
      const cards = visible.filter(row => stageFor(row) === column.key);
      return <section key={column.key} className="min-w-0 rounded-2xl border bg-muted/40 p-3" aria-label={column.title}><header className="mb-4 px-1"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{column.title}</h2><span className="rounded-full bg-card px-2.5 py-1 text-sm font-semibold tabular-nums" aria-label={`${cards.length} retailers`}>{cards.length}</span></div><p className="mt-1 text-xs text-muted-foreground">{column.description}</p></header><div className="space-y-3">{cards.length ? cards.map(row => <PartnerKanbanCard key={row.store.id} row={row} onDocuments={setSelected} />) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{term ? 'No matching retailers' : 'No retailers in this stage'}</p>}</div></section>;
    })}</div></>}
    {selectedRow && <PartnerDocumentsDialog key={selectedRow.store.id} row={selectedRow} onClose={() => setSelected('')} />}
  </section>;
}