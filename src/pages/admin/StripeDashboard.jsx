import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CreditCard,
  RefreshCw,
  TrendingUp,
  Users,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  Wallet,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function StripeDashboard() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['stripe-dashboard'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStripeDashboard', {});
      return res.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (data?.error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>Stripe error: {data.error}</span>
        </div>
      </Card>
    );
  }

  const account = data?.account;
  const balance = data?.balance;
  const availableUsd = balance?.available?.find(b => b.currency === 'usd')?.amount || 0;
  const pendingUsd = balance?.pending?.find(b => b.currency === 'usd')?.amount || 0;

  const stats = [
    {
      label: 'Revenue (30d)',
      value: `$${(data?.total_revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-emerald-600',
    },
    {
      label: 'Payments',
      value: data?.payment_count || 0,
      icon: CreditCard,
      color: 'text-blue-600',
    },
    {
      label: 'Active Subs',
      value: data?.active_subscriptions || 0,
      icon: Users,
      color: 'text-purple-600',
    },
    {
      label: 'Trialing',
      value: data?.trialing_subscriptions || 0,
      icon: TrendingUp,
      color: 'text-amber-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Stripe Dashboard</h1>
            <p className="text-sm text-muted-foreground">Live payments, balance & subscriptions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-emerald-500 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live Mode
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Account status */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Account Status</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Account ID</p>
            <p className="text-sm font-mono truncate">{account?.id || '—'}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Country</p>
            <p className="text-sm font-semibold uppercase">{account?.country || '—'}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Charges Enabled</p>
            {account?.charges_enabled ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Yes</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">No</Badge>
            )}
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground font-medium mb-1">Payouts Enabled</p>
            {account?.payouts_enabled ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Yes</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">No</Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-sm">Available Balance</h2>
          </div>
          <p className="text-3xl font-bold text-emerald-600">
            ${availableUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Ready to pay out</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-sm">Pending Balance</h2>
          </div>
          <p className="text-3xl font-bold text-amber-600">
            ${pendingUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Awaiting settlement</p>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
            </div>
            <p className="text-xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

      {(data?.refunded_amount > 0 || data?.canceled_subscriptions > 0) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {data?.refunded_amount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-red-600" />
              Refunds (30d): <span className="font-semibold text-red-600">${data.refunded_amount.toFixed(2)}</span>
            </span>
          )}
          {data?.canceled_subscriptions > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5">
              Canceled subs: <span className="font-semibold">{data.canceled_subscriptions}</span>
            </span>
          )}
        </div>
      )}

      {/* Recent payments */}
      <Card className="p-5">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          Recent Payments
        </h2>
        {(data?.recent_payments || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No recent payments</p>
        ) : (
          <div className="space-y-1">
            {data.recent_payments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {payment.customer_email || payment.description || 'Payment'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(payment.created), 'MMM d, h:mm a')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-sm text-emerald-600">
                    ${payment.amount.toFixed(2)}
                  </span>
                  {payment.receipt_url && (
                    <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Active subscriptions */}
      <Card className="p-5">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Active Subscriptions
        </h2>
        {(data?.subscriptions || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active subscriptions</p>
        ) : (
          <div className="space-y-1">
            {data.subscriptions.map(sub => (
              <div key={sub.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium font-mono truncate">{sub.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {sub.current_period_end ? `Renews ${format(new Date(sub.current_period_end), 'MMM d, yyyy')}` : ''}
                    {sub.interval ? ` · ${sub.interval}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-sm">
                    ${sub.amount.toFixed(2)}{sub.interval ? `/${sub.interval === 'month' ? 'mo' : sub.interval}` : ''}
                  </span>
                  <Badge variant="outline" className={sub.status === 'active' ? 'border-emerald-500 text-emerald-700' : ''}>
                    {sub.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}