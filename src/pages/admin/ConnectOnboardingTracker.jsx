import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CheckCircle2, Clock, AlertCircle, CircleDashed, CreditCard } from 'lucide-react';

const STATUS_META = {
  complete: { label: 'Complete', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: Clock },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  not_started: { label: 'Not Started', color: 'bg-slate-100 text-slate-600', icon: CircleDashed },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function ConnectOnboardingTracker() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['store-connect-status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStoreConnectStatus', {});
      return res.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (data?.error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{data.error}</span>
        </div>
      </Card>
    );
  }

  const s = data?.summary || {};
  const stores = data?.stores || [];

  const summaryCards = [
    { label: 'Total', value: s.total || 0, color: 'text-slate-700' },
    { label: 'Complete', value: s.complete || 0, color: 'text-emerald-600' },
    { label: 'In Progress', value: (s.in_progress || 0) + (s.pending || 0), color: 'text-amber-600' },
    { label: 'Not Started', value: s.not_started || 0, color: 'text-slate-500' },
    { label: 'Error', value: s.error || 0, color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Stripe Connect Onboarding</h1>
            <p className="text-sm text-muted-foreground">Live status of each retailer's payout setup</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map(c => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Store</th>
                <th className="text-left font-medium px-4 py-3">Email</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="text-center font-medium px-4 py-3">Charges</th>
                <th className="text-center font-medium px-4 py-3">Payouts</th>
                <th className="text-left font-medium px-4 py-3">Pending Requirements</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(st => {
                const meta = STATUS_META[st.status] || STATUS_META.not_started;
                const Icon = meta.icon;
                return (
                  <tr key={st.store_id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{st.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{st.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st.charges_enabled
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {st.payouts_enabled
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                        : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {st.error ? (
                        <span className="text-red-600">{st.error}</span>
                      ) : (st.currently_due?.length > 0) ? (
                        <span className="text-amber-600">{st.currently_due.join(', ')}</span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Stores appear as "Complete" once Stripe confirms both charges and payouts are enabled after they finish KYC + bank verification.
        Click Refresh to re-check live status from Stripe.
      </p>
    </div>
  );
}