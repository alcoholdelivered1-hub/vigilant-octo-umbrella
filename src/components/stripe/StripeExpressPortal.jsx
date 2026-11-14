import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Landmark, Loader2, CheckCircle2, AlertTriangle, Clock,
  DollarSign, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Settings,
} from 'lucide-react';

export default function StripeExpressPortal({ storeId }) {
  const queryClient = useQueryClient();
  const [loginLoading, setLoginLoading] = useState(false);

  // Handle return from Stripe onboarding
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1' || params.get('stripe_connected') === '1') {
      queryClient.invalidateQueries({ queryKey: ['stripe-express-portal', storeId] });
      toast.success('🎉 Stripe account connected!');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [storeId]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stripe-express-portal', storeId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStripeExpressPortal', {
        store_id: storeId || null,
      });
      return res.data;
    },
    enabled: !storeId || true,
  });

  const handleOpenDashboard = async () => {
    setLoginLoading(true);
    try {
      const res = await base44.functions.invoke('getStripeExpressPortal', {
        store_id: storeId || null,
        action: fullyEnabled ? 'login' : 'onboarding',
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.data?.error || 'Could not open Stripe');
      }
    } catch (err) {
      toast.error('Failed to open Stripe dashboard: ' + (err.message || 'unknown error'));
    }
    setLoginLoading(false);
  };

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Card>
    );
  }

  if (data?.error) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Payout Account Not Set Up</p>
            <p className="text-xs text-muted-foreground mt-1">{data.error}</p>
          </div>
        </div>
      </Card>
    );
  }

  const fullyEnabled = data?.payouts_enabled && data?.charges_enabled;
  const hasRequirements = (data?.requirements?.currently_due || []).length > 0 ||
    (data?.requirements?.errors || []).length > 0;

  const availableBalance = data?.balance?.available?.[0]?.amount || 0;
  const pendingBalance = data?.balance?.pending?.[0]?.amount || 0;

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Payouts Dashboard</h2>
            <p className="text-xs text-muted-foreground">
              {storeId ? 'Store payout account' : 'Driver payout account'} ·{' '}
              <span className="font-mono">{data?.account_id?.slice(0, 16)}…</span>
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Status banner */}
      <div className="mb-4">
        {fullyEnabled ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium text-emerald-800">Account active — payouts enabled</span>
          </div>
        ) : hasRequirements ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Action required — complete your Stripe setup</p>
              {(data?.requirements?.errors || []).slice(0, 2).map((err, i) => (
                <p key={i} className="text-xs text-amber-700 mt-0.5">{err.message || err.reason}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-blue-800">Onboarding in progress — payouts pending verification</span>
          </div>
        )}
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs text-muted-foreground font-medium">Available</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">
            ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs text-muted-foreground font-medium">Pending</span>
          </div>
          <p className="text-xl font-bold text-amber-600">
            ${pendingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Stripe dashboard button */}
      <Button
        onClick={handleOpenDashboard}
        disabled={loginLoading}
        className="w-full rounded-xl gap-2 mb-4"
        size="lg"
      >
        {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
        {loginLoading ? 'Opening…' : fullyEnabled ? 'Open Stripe Dashboard' : 'Complete Stripe Setup'}
      </Button>

      {/* Recent payouts */}
      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <ArrowDownToLine className="w-3.5 h-3.5" /> Recent Payouts
        </p>
        {(data?.payouts || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No payouts yet</p>
        ) : (
          <div className="space-y-1.5">
            {data.payouts.map(payout => (
              <div key={payout.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-600">
                      +${payout.amount.toFixed(2)}
                    </span>
                    <Badge variant={payout.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                      {payout.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(payout.arrival_date), 'MMM d, yyyy')} · {payout.method}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent transfers */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <ArrowUpFromLine className="w-3.5 h-3.5" /> Recent Transfers In
        </p>
        {(data?.transfers || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No transfers yet</p>
        ) : (
          <div className="space-y-1.5">
            {data.transfers.map(transfer => (
              <div key={transfer.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="text-sm font-semibold">
                    +${transfer.amount.toFixed(2)}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(transfer.created), 'MMM d, yyyy')}
                    {transfer.description ? ` · ${transfer.description}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}