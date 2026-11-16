import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Link2, Unlink } from 'lucide-react';
import { toast } from 'sonner';

export default function CityHiveConnectionPanel({ storeId }) {
  const [token, setToken] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const queryClient = useQueryClient();

  const { data: connection, isLoading } = useQuery({
    queryKey: ['cityhive-connection', storeId],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('syncCityHiveInventory', { store_id: storeId, action: 'status' });
      return data;
    },
    enabled: !!storeId,
    retry: false,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('syncCityHiveInventory', {
        store_id: storeId,
        action: 'connect',
        api_token: token,
        merchant_name: merchantName,
      });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('CityHive connected successfully');
      setToken('');
      queryClient.invalidateQueries({ queryKey: ['cityhive-connection', storeId] });
    },
    onError: (error) => toast.error(error?.response?.data?.error || error.message),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('syncCityHiveInventory', { store_id: storeId, action: 'sync' });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} products from CityHive (${data.created} new, ${data.updated} updated)`);
      queryClient.invalidateQueries({ queryKey: ['cityhive-connection', storeId] });
      queryClient.invalidateQueries({ queryKey: ['store-products', storeId] });
    },
    onError: (error) => toast.error(error?.response?.data?.error || error.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('syncCityHiveInventory', { store_id: storeId, action: 'disconnect' });
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('CityHive disconnected');
      queryClient.invalidateQueries({ queryKey: ['cityhive-connection', storeId] });
    },
    onError: (error) => toast.error(error?.response?.data?.error || error.message),
  });

  if (isLoading) {
    return <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading CityHive connection…</div>;
  }

  const isConnected = connection?.status === 'connected' || connection?.connection_id;

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">CityHive Inventory Sync</h3>
          <p className="text-xs text-muted-foreground">Pull live inventory items and prices from your CityHive merchant account.</p>
        </div>
        {isConnected ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            <XCircle className="w-3.5 h-3.5" /> Not connected
          </span>
        )}
      </div>

      {isConnected ? (
        <div className="space-y-3">
          {connection?.merchant_name && <p className="text-sm text-muted-foreground">Merchant: <span className="font-medium text-foreground">{connection.merchant_name}</span></p>}
          {connection?.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Last synced: {new Date(connection.last_synced_at).toLocaleString()}
              {connection.last_sync_count != null && ` (${connection.last_sync_count} products)`}
            </p>
          )}
          {connection?.last_sync_error && (
            <p className="text-xs text-destructive">Last error: {connection.last_sync_error}</p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="flex-1">
              {syncMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <><RefreshCw className="w-4 h-4" /> Sync inventory</>}
            </Button>
            <Button variant="outline" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              <Unlink className="w-4 h-4" /> Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cityhive-token">CityHive API Token</Label>
            <Input
              id="cityhive-token"
              type="password"
              placeholder="Paste your CityHive merchant API token"
              value={token}
              onChange={e => setToken(e.target.value)}
              disabled={connectMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Find your API token in your <a href="https://merchants.cityhive.net/" target="_blank" rel="noopener noreferrer" className="underline text-primary">CityHive merchant portal</a> under Settings.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cityhive-merchant">Merchant name (optional)</Label>
            <Input
              id="cityhive-merchant"
              placeholder="e.g. Beverage King"
              value={merchantName}
              onChange={e => setMerchantName(e.target.value)}
              disabled={connectMutation.isPending}
            />
          </div>
          <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending || !token} className="w-full">
            {connectMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : <><Link2 className="w-4 h-4" /> Connect CityHive</>}
          </Button>
        </div>
      )}
    </div>
  );
}