import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { RefreshCw } from 'lucide-react';
import CustomerLaunchPanel from '@/components/launch/CustomerLaunchPanel';
import RetailerLaunchPanel from '@/components/launch/RetailerLaunchPanel';
import MobileReleasePanel from '@/components/launch/MobileReleasePanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function StoreLaunchProgress() {
  const { user } = useAuth();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const storesQuery = useQuery({
    queryKey: ['all-retailer-launch-stores', refreshVersion],
    queryFn: async () => {
      const stores = [];
      let cursor = null;
      do {
        const page = await base44.entities.Store.list({ sort: 'name', limit: 100, cursor });
        stores.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor);
      return stores;
    },
    enabled: user?.role === 'admin',
    refetchInterval: 60000,
  });
  if (user?.role !== 'admin') return <p className="p-8 text-muted-foreground">Sign in as an administrator to manage go-live.</p>;
  const stores = storesQuery.data || [];
  const selectedStore = stores.find(s => s.id === selectedStoreId) || stores.find(s => /beverage king/i.test(s.name)) || stores[0];
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-3xl font-bold">Go-Live Command Center</h1><p className="mt-2 text-muted-foreground">Customer ordering, retailer activation and iPhone/Android release preparation in one place.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href="https://docs.google.com/spreadsheets/d/1DJBJ9EJ1lNr-Itk2uWgigczKBna8opfKWcSUOv1neTM/edit" target="_blank" rel="noopener noreferrer">Open Google Sheet tracker</a></Button><Button variant="outline" onClick={() => setRefreshVersion(v => v + 1)}><RefreshCw className="w-4 h-4" />Refresh all retailers</Button></div></header>
      <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">Saved launch evidence refreshes every five minutes. No retailer is activated by viewing this screen: final approval, verified payments, licensing and delivery readiness are still required.</div>
      {storesQuery.isLoading ? <p role="status" className="text-muted-foreground">Loading retailers…</p> : storesQuery.isError ? <div role="alert" className="space-y-3"><p className="text-destructive">Could not load retailer launch statuses.</p><Button variant="outline" onClick={() => storesQuery.refetch()}>Try again</Button></div> : <>
        {selectedStore ? <div className="space-y-2"><label htmlFor="go-live-retailer" className="text-sm font-semibold">Selected retailer</label><Select value={selectedStore.id} onValueChange={setSelectedStoreId}><SelectTrigger id="go-live-retailer" className="min-h-11 w-full rounded-lg border border-input bg-card px-3 text-foreground sm:max-w-md"><SelectValue /></SelectTrigger><SelectContent className="max-h-80">{stores.map(store => <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>)}</SelectContent></Select></div> : <p className="text-muted-foreground">No retailers added yet. <Link className="text-primary underline" to="/admin/stores">Add a retailer</Link> to begin customer launch preparation.</p>}
        <Tabs defaultValue="customers" className="space-y-5"><TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3"><TabsTrigger value="customers" className="min-h-11">1. Customer ordering</TabsTrigger><TabsTrigger value="retailers" className="min-h-11">2. Retailer activation</TabsTrigger><TabsTrigger value="mobile" className="min-h-11">3. iPhone & Android</TabsTrigger></TabsList><TabsContent value="customers"><CustomerLaunchPanel stores={stores} store={selectedStore} refreshVersion={refreshVersion} /></TabsContent><TabsContent value="retailers">{stores.length ? <RetailerLaunchPanel stores={stores} store={selectedStore} refreshVersion={refreshVersion} /> : <p className="text-muted-foreground">Add a retailer to review launch requirements.</p>}</TabsContent><TabsContent value="mobile"><MobileReleasePanel /></TabsContent></Tabs>
      </>}
      <Link to="/admin/retailer-onboarding" className="inline-block text-sm font-medium text-primary underline underline-offset-4">View all retailer onboarding</Link>
    </div>
  );
}