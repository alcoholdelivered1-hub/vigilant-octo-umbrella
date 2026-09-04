import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Receipt, ArrowUpRight, CheckCircle2, XCircle, ExternalLink, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';
const fmtUSD = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export default function CloverSalesDashboard() {
  const [status, setStatus] = useState(null);
  const [pushedOrders, setPushedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, orders] = await Promise.all([
        base44.functions.invoke('syncCloverSalesToStripe', { action: 'status', store_id: BEVERAGE_KING_STORE_ID }),
        base44.entities.Order.list('-created_date', 200),
      ]);
      setStatus(s.data);
      setPushedOrders((orders || []).filter(o => o.clover_order_id));
    } catch (e) {
      toast.error('Failed to load Clover data: ' + (e?.response?.data?.error || e.message), { duration: 8000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncCloverSalesToStripe', { action: 'sync', store_id: BEVERAGE_KING_STORE_ID });
      setSyncResult(res.data);
      if (res.data?.success) {
        toast.success(`Synced ${res.data.created} new · ${res.data.skipped_already_mirrored} already mirrored · ${res.data.paid_orders_found} paid orders found`);
      } else {
        toast.error(res.data?.error || 'Sync failed', { duration: 8000 });
      }
      await loadAll();
    } catch (e) {
      toast.error('Sync failed: ' + (e?.response?.data?.error || e.message), { duration: 8000 });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const revenue = status?.total_clover_revenue_cents || 0;
  const invoices = status?.recent_invoices || [];
  const syncState = status?.sync_state;
  const tokenValid = !!status?.token_valid;
  const connected = !!status?.clover_configured;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" /> Clover Sales & Orders
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Clover POS sales mirrored to Stripe and app orders pushed to Clover.</p>
        </div>
        <Button onClick={handleSync} disabled={syncing || !connected} className="gap-2">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing…' : 'Sync Clover Sales Now'}
        </Button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="w-3.5 h-3.5" /> Clover POS Revenue</div>
          <div className="text-2xl font-bold mt-1">{fmtUSD(revenue)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{invoices.length} mirrored invoices</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Total Synced</div>
          <div className="text-2xl font-bold mt-1">{syncState?.total_synced ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{syncState ? `Last: ${fmtDate(syncState.last_synced_at)}` : 'Never synced'}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><ArrowUpRight className="w-3.5 h-3.5" /> Pushed to Clover</div>
          <div className="text-2xl font-bold mt-1">{pushedOrders.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">app orders on POS</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            {tokenValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
            Connection
          </div>
          <div className="text-base font-bold mt-1">{tokenValid ? 'Valid' : (connected ? 'Invalid token' : 'Not configured')}</div>
          <div className="text-xs text-muted-foreground mt-0.5 capitalize">{status?.valid_environment || status?.token_source || '—'}</div>
        </Card>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <Card className={`p-4 ${syncResult.success ? 'border-emerald-200 bg-emerald-50/60' : 'border-destructive/30 bg-destructive/5'}`}>
          <p className="text-sm font-medium">Last sync result</p>
          <pre className="text-xs mt-2 overflow-auto max-h-40">{JSON.stringify(syncResult, null, 2)}</pre>
        </Card>
      )}

      {!tokenValid && (
        <Card className="p-4 border-amber-200 bg-amber-50/60 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Clover token is not authenticating</p>
            <p className="text-amber-700">Complete merchant-scoped OAuth at <a href="/admin/beverage-king-clover" className="underline font-medium">Beverage King Clover Setup</a> before syncing or pushing orders.</p>
          </div>
        </Card>
      )}

      {/* Clover POS sales mirrored to Stripe */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Receipt className="w-4 h-4" /> Clover POS Sales → Stripe</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No Clover POS sales mirrored to Stripe yet. Run a sync to pull paid POS orders.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Invoice</th>
                  <th className="pb-2 font-medium">Clover Order</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2.5 font-mono text-xs">{inv.number}</td>
                    <td className="py-2.5 font-mono text-xs">{inv.clover_order_id || '—'}</td>
                    <td className="py-2.5 font-medium">{fmtUSD(inv.total)}</td>
                    <td className="py-2.5"><Badge variant={inv.status === 'paid' ? 'default' : 'outline'}>{inv.status}</Badge></td>
                    <td className="py-2.5 text-muted-foreground">{fmtDate(inv.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* App orders pushed to Clover POS */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> Orders Pushed to Clover POS</h3>
        {pushedOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No app orders have been pushed to Clover yet. Paid orders push automatically via the "Fulfill Order After Payment" workflow once the Clover connection is valid.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-2 font-medium">Order #</th>
                  <th className="pb-2 font-medium">Store</th>
                  <th className="pb-2 font-medium">Clover Order ID</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {pushedOrders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="py-2.5 font-mono text-xs">{o.order_number}</td>
                    <td className="py-2.5">{o.store_name}</td>
                    <td className="py-2.5 font-mono text-xs">{o.clover_order_id}</td>
                    <td className="py-2.5 font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(o.total)}</td>
                    <td className="py-2.5"><Badge variant="outline">{o.status}</Badge></td>
                    <td className="py-2.5">
                      <a href={`https://www.clover.com/dashboard/orders/${o.clover_order_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                        View <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}