import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CreditCard, RefreshCw, TrendingUp, Users, DollarSign, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

export default function StripeOverview() {
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
      <Card className="p-5">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </Card>
    );
  }

  if (data?.error) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 text-sm text-red-600">
          <CreditCard className="w-4 h-4" />
          <span>Stripe: {data.error}</span>
        </div>
      </Card>
    );
  }

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
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          Stripe Payments
        </h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(stat => (
          <div key={stat.label} className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
            </div>
            <p className="text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {data?.refunded_amount > 0 && (
        <div className="mb-3 text-xs text-muted-foreground">
          Refunds (30d): <span className="font-semibold text-red-600">${data.refunded_amount.toFixed(2)}</span>
        </div>
      )}

      {/* Recent payments */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">Recent Payments</p>
        {(data?.recent_payments || []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No recent payments</p>
        ) : (
          data.recent_payments.map(payment => (
            <div key={payment.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
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
          ))
        )}
      </div>
    </Card>
  );
}