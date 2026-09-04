import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  RefreshCw, CheckCircle2, Clock, AlertCircle, CircleDashed,
  CreditCard, Mail, Loader2, Send, Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_META = {
  complete:     { label: 'Complete',    color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  in_progress:   { label: 'In Progress', color: 'bg-amber-100 text-amber-700',     icon: Clock },
  pending:       { label: 'Pending',      color: 'bg-amber-100 text-amber-700',     icon: Clock },
  not_started:  { label: 'Not Started', color: 'bg-slate-100 text-slate-600',     icon: CircleDashed },
  error:         { label: 'Error',        color: 'bg-red-100 text-red-700',          icon: AlertCircle },
};

const NEEDS_HELP = ['in_progress', 'pending', 'not_started', 'error'];

export default function StripeOnboardingHub() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [lastBlast, setLastBlast] = useState(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['store-connect-status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStoreConnectStatus', {});
      return res.data;
    },
    refetchInterval: 60000,
  });

  const kycMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('sendStripeKycHelp', {});
      return res.data;
    },
    onSuccess: (result) => {
      setLastBlast(result);
      const sent = result.sent ?? 0;
      const failed = result.failed ?? 0;
      const skipped = result.skipped ?? 0;
      if (failed > 0) {
        toast.warning(`KYC help sent to ${sent} retailer(s)`, {
          description: `${failed} failed, ${skipped} already complete / skipped.`,
          duration: 7000,
        });
      } else {
        toast.success(`KYC help sent to ${sent} retailer(s)`, {
          description: `${skipped} already complete / skipped.`,
          duration: 6000,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['store-connect-status'] });
    },
    onError: (err) => {
      toast.error('Failed to send KYC emails', { description: err.message });
    },
  });

  const [reconnectingId, setReconnectingId] = useState(null);
  const reconnectMutation = useMutation({
    mutationFn: async (storeId) => {
      setReconnectingId(storeId);
      const res = await base44.functions.invoke('stripeConnectOnboardStore', { store_id: storeId });
      if (res?.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (result) => {
      if (result?.url) window.open(result.url, '_blank', 'noopener,noreferrer');
      toast.success(
        result?.reconnected
          ? 'Previous Stripe account had revoked access — a fresh account was created'
          : 'Stripe onboarding link ready',
        { description: 'Onboarding opened in a new tab — the store owner completes bank/KYC setup there.', duration: 8000 }
      );
      queryClient.invalidateQueries({ queryKey: ['store-connect-status'] });
    },
    onError: (err) => {
      toast.error('Reconnect failed', { description: err.message });
    },
    onSettled: () => setReconnectingId(null),
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
  const allStores = data?.stores || [];
  const stores = filter === 'all' ? allStores : allStores.filter(st => st.status === filter);
  const needsHelpCount = allStores.filter(st => NEEDS_HELP.includes(st.status)).length;

  const summaryCards = [
    { label: 'Total',       value: s.total || 0,                            color: 'text-slate-700' },
    { label: 'Complete',    value: s.complete || 0,                         color: 'text-emerald-600' },
    { label: 'In Progress', value: (s.in_progress || 0) + (s.pending || 0), color: 'text-amber-600' },
    { label: 'Not Started', value: s.not_started || 0,                     color: 'text-slate-500' },
    { label: 'Error',       value: s.error || 0,                           color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Stripe Onboarding Hub</h1>
            <p className="text-sm text-muted-foreground">
              Live payout-setup status for every retailer · {needsHelpCount} need KYC help
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => kycMutation.mutate()}
            disabled={kycMutation.isPending || needsHelpCount === 0}
            className="gap-1.5"
          >
            {kycMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
            Send KYC Help Emails
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summaryCards.map(c => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
            <p className={cn('text-2xl font-bold', c.color)}>{c.value}</p>
          </Card>
        ))}
      </div>

      {/* Last blast result */}
      {lastBlast && (
        <Card className="p-4 bg-muted/30 border-dashed">
          <div className="flex items-start gap-2 text-sm">
            <Mail className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">
                Last blast: {lastBlast.sent} sent · {lastBlast.skipped} skipped · {lastBlast.failed} failed
              </p>
              {lastBlast.results?.some(r => r.status === 'failed') && (
                <p className="text-xs text-red-600 mt-1">
                  {lastBlast.results.filter(r => r.status === 'failed').slice(0, 5).map(r => `${r.store}: ${r.error || ''}`).join(' · ')}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Filter by status:</span>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ({allStores.length})</SelectItem>
            <SelectItem value="complete">Complete ({s.complete || 0})</SelectItem>
            <SelectItem value="in_progress">In Progress ({(s.in_progress || 0) + (s.pending || 0)})</SelectItem>
            <SelectItem value="not_started">Not Started ({s.not_started || 0})</SelectItem>
            <SelectItem value="error">Error ({s.error || 0})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                <th className="text-right font-medium px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {stores.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No stores match this filter.
                  </td>
                </tr>
              )}
              {stores.map(st => {
                const meta = STATUS_META[st.status] || STATUS_META.not_started;
                const Icon = meta.icon;
                return (
                  <tr key={st.store_id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{st.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{st.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', meta.color)}>
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
                    <td className="px-4 py-3 text-right">
                      {st.status !== 'complete' && (
                        <Button
                          variant={st.status === 'error' ? 'destructive' : 'outline'}
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={reconnectMutation.isPending}
                          onClick={() => reconnectMutation.mutate(st.store_id)}
                        >
                          {reconnectingId === st.store_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Link2 className="w-3 h-3" />}
                          {st.status === 'error' ? 'Reconnect' : 'Onboarding link'}
                        </Button>
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
        "Send KYC Help Emails" emails every retailer that hasn't fully completed Stripe onboarding with a
        personalized step-by-step guide and a fresh onboarding link. Already-complete stores are skipped.
      </p>
    </div>
  );
}