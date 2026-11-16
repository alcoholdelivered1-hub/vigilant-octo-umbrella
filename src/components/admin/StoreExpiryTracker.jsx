import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Loader2 } from 'lucide-react';
import useStoreExpiry from '@/components/admin/useStoreExpiry';
import StoreExpiryRow from '@/components/admin/StoreExpiryRow';
import { Button } from '@/components/ui/button';

export default function StoreExpiryTracker() {
  const { rows, storeCount, missingDates, isLoading, error, refetch, isFetching } = useStoreExpiry();
  return <section className="mb-8 rounded-2xl border bg-card p-5" aria-labelledby="store-expiry-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="store-expiry-heading" className="font-semibold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" aria-hidden="true" />Compliance Tracker — Next 30 Days</h2>
      <Link to="/admin/store-compliance" className="text-sm text-primary underline">Review compliance</Link>
    </div>
    <p className="text-sm text-muted-foreground mt-1">Store licenses and permits expiring today through the next 30 days. Deadlines within 7 days are marked urgent.</p>
    <div className="mt-4" aria-live="polite">
      {isLoading ? <p className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading expiration dates…</p> : error ? <div className="space-y-2"><p className="text-sm text-destructive">Could not load the compliance tracker.</p><Button variant="outline" onClick={() => refetch()} disabled={isFetching}>Retry</Button></div> : <>
        <p className="text-sm font-medium mb-3">{storeCount} {storeCount === 1 ? 'store' : 'stores'} · {rows.length} expiring {rows.length === 1 ? 'document' : 'documents'}</p>
        {rows.length ? <ul className="space-y-3 max-h-96 overflow-y-auto">{rows.map(document => <StoreExpiryRow key={document.key} document={document} />)}</ul> : <p className="text-sm text-muted-foreground">No recorded store licenses or permits expire within the next 30 days.</p>}
        {missingDates > 0 && <p className="text-sm text-muted-foreground mt-3">{missingDates} {missingDates === 1 ? 'document has' : 'documents have'} a missing or invalid expiration date and cannot be assessed. Add verified dates in the compliance records.</p>}
      </>}
    </div>
  </section>;
}