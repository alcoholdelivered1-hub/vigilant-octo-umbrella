import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import RetailerDirectContact from '@/components/partner/RetailerDirectContact';
import RetailerSetupWorkspace from '@/components/onboarding/RetailerSetupWorkspace';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const call = async payload => {
  const { data } = await base44.functions.invoke('retailerSetup', payload);
  if (data?.error || !data) throw new Error(data?.error || 'Could not load retailer setup.');
  return data;
};

export default function RetailerOnboardingHub() {
  const [draftPending, setDraftPending] = useState(false);
  const [params, setParams] = useSearchParams();
  const list = useQuery({ queryKey: ['setup-store-list'], queryFn: () => call({ action: 'list' }), retry: false });
  const selected = params.get('store_id') || (list.data?.stores.length === 1 ? list.data.stores[0].id : '');
  const details = useQuery({ queryKey: ['retailer-setup', selected], enabled: !!selected, queryFn: () => call({ action: 'get', store_id: selected }), retry: false, refetchOnWindowFocus: false });
  return <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-bold">Set up your store</h1><p className="mt-2 text-sm text-muted-foreground">Work through one task at a time. Your saved details and submitted documents stay available.</p></div>{selected && <Button variant="outline" disabled={details.isFetching || draftPending} onClick={() => details.refetch()}>Refresh progress</Button>}</header>
    {list.isLoading && <p role="status">Loading your stores…</p>}
    {list.error && <div role="alert" className="space-y-2"><p className="text-destructive">{list.error?.response?.data?.error || list.error.message}</p><Button variant="outline" onClick={() => list.refetch()}>Try again</Button></div>}
    {list.data && (list.data.stores.length > 1 || !selected) && <div className="space-y-1.5"><Label>Your store</Label><Select value={selected || undefined} disabled={draftPending} onValueChange={value => setParams({ store_id: value })}><SelectTrigger className="min-h-11 w-full"><SelectValue placeholder="Choose your store" /></SelectTrigger><SelectContent>{list.data.stores.map(store => <SelectItem key={store.id} value={store.id}>{store.name} — {store.city}</SelectItem>)}</SelectContent></Select></div>}
    {list.data && !list.data.stores.length && <><p>No store is linked to this account yet. Call John to link your existing store.</p><RetailerDirectContact /></>}
    {details.isLoading && selected && <p role="status">Loading your saved progress…</p>}
    {details.error && <div role="alert" className="space-y-3"><p className="text-destructive">{details.error?.response?.data?.error || details.error.message}</p><Button variant="outline" onClick={() => details.refetch()}>Try again</Button><RetailerDirectContact /></div>}
    {details.data && <RetailerSetupWorkspace key={selected} data={details.data} onSaved={details.refetch} onDraftStateChanged={setDraftPending} />}
  </div>;
}