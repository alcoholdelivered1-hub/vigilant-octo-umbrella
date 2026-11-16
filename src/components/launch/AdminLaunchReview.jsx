import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import SetupLaunchReview from '@/components/onboarding/SetupLaunchReview';
export default function AdminLaunchReview({ store, refreshVersion }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey:['go-live-launch-review',store?.id,refreshVersion],enabled:!!store,refetchOnWindowFocus:false,retry:false,queryFn:async () => { const { data } = await base44.functions.invoke('retailerSetup',{ action:'get',store_id:store.id }); if (data.error || data.store?.id !== store.id) throw new Error(data.error || 'Could not load this retailer’s launch review.'); return data; } });
  const refresh = async () => { await query.refetch(); await Promise.all(['all-retailer-launch-stores','retailer-launch-previews','stores','store'].map(key => client.invalidateQueries({ queryKey:[key] }))); };
  if (!store) return null;
  if (query.isLoading) return <p role="status" className="text-sm text-muted-foreground">Loading launch review for {store.name}…</p>;
  if (query.isError) return <div role="alert" className="rounded-xl border bg-card p-4 space-y-3"><p className="text-destructive">{query.error.response?.data?.error || query.error.message}</p><Button variant="outline" onClick={() => query.refetch()}>Retry launch review</Button></div>;
  return <div className="space-y-3"><h2 className="font-display text-2xl font-semibold">Activation controls: {store.name}</h2><SetupLaunchReview key={store.id} data={query.data} onSaved={refresh} /></div>;
}