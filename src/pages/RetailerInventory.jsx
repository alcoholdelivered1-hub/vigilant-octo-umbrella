import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import useOwnerStores from '@/components/partner/useOwnerStores';
import RetailerInventoryWorkspace from '@/components/inventory/RetailerInventoryWorkspace';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RetailerInventory() {
  const { user } = useAuth();
  const storesQuery = useOwnerStores(user);
  const [selectedStore, setSelectedStore] = useState(() => new URLSearchParams(window.location.search).get('store_id') || '');
  const stores = storesQuery.data || [];
  const store = stores.find(item => item.id === selectedStore) || stores[0];
  return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <header className="space-y-2"><div className="flex items-start gap-3"><Package className="w-7 h-7 text-primary shrink-0 mt-1" aria-hidden="true" /><h1 className="font-display text-3xl font-bold">Retailer Inventory Management</h1></div><p className="text-muted-foreground">Add, edit, and remove products, and keep your store’s prices and stock up to date.</p><Link to="/retailer-dashboard" className="inline-block text-sm text-primary underline underline-offset-4">Back to retailer dashboard</Link></header>
    {!user ? <Button onClick={() => base44.auth.redirectToLogin('/retailer-inventory')}>Sign in to manage inventory</Button> : storesQuery.isLoading ? <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />Loading your stores…</p> : storesQuery.isError ? <div role="alert" className="space-y-3"><p className="text-destructive">Could not load your stores.</p><Button variant="outline" onClick={() => storesQuery.refetch()}>Try again</Button></div> : !store ? <div className="rounded-xl border bg-card p-6"><h2 className="font-semibold">No store linked</h2><p className="text-sm text-muted-foreground mt-2">Ask the administrator to link your account email to your store before managing products.</p></div> : <>
      <div className="max-w-md space-y-2"><Label htmlFor="inventory-store">Your store</Label><Select value={store.id} onValueChange={setSelectedStore}><SelectTrigger id="inventory-store" className="min-h-11 w-full"><SelectValue placeholder="Select your store" /></SelectTrigger><SelectContent>{stores.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
      <RetailerInventoryWorkspace key={store.id} store={store} />
    </>}
  </div>;
}