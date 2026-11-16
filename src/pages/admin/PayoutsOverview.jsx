import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, DollarSign, Clock, CheckCircle2, Store, Truck, Wallet } from 'lucide-react';
import { format } from 'date-fns';

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export default function PayoutsOverview() {
  const [tab, setTab] = useState('driver');

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['payouts-overview'],
    queryFn: () => base44.entities.DriverPayout.list('-week_start', 200),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['delivered-orders-transfers'],
    queryFn: () => base44.entities.Order.filter({ status: 'delivered' }, '-created_date', 200),
  });

  const pending = payouts.filter(p => p.status === 'pending');
  const paid = payouts.filter(p => p.status === 'paid');
  const failed = payouts.filter(p => p.status === 'failed');

  // Group delivered orders by store for transfer history
  const storeTransfers = orders.reduce((acc, o) => {
    const key = o.store_id || 'unknown';
    if (!acc[key]) acc[key] = { store_name: o.store_name || 'Unknown Store', orders: 0, subtotal: 0, fees: 0, connect_id: o.stripe_connect_account_id || '' };
    acc[key].orders += 1;
    acc[key].subtotal += Number(o.subtotal) || 0;
    acc[key].fees += Number(o.stripe_application_fee_amount) || 0;
    if (!acc[key].connect_id && o.stripe_connect_account_id) acc[key].connect_id = o.stripe_connect_account_id;
    return acc;
  }, {});
  const transferRows = Object.values(storeTransfers).sort((a, b) => b.subtotal - a.subtotal);

  const pendingTotal = pending.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
  const paidTotal = paid.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
  const transferTotal = transferRows.reduce((s, r) => s + r.subtotal, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Wallet className="w-7 h-7 text-primary" /> Payouts Overview
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitor pending driver transfers and review store settlement history for retail partners.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <Clock className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-bold">{fmt(pendingTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pending.length} Pending Driver Payouts</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mb-2" />
          <p className="text-2xl font-bold">{fmt(paidTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{paid.length} Paid Payouts</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <Store className="w-5 h-5 text-primary mb-2" />
          <p className="text-2xl font-bold">{fmt(transferTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">Store Transfers (Delivered)</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <Truck className="w-5 h-5 text-muted-foreground mb-2" />
          <p className="text-2xl font-bold">{failed.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Failed Payouts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'driver', label: 'Driver Payouts' },
          { id: 'store', label: 'Store Transfers' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'driver' ? (
        isLoading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-16 bg-card border rounded-2xl">
            <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground mt-4">No driver payouts recorded yet</p>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Driver</th>
                  <th className="text-left p-3 font-medium">Pay Week</th>
                  <th className="text-left p-3 font-medium">Deliveries</th>
                  <th className="text-left p-3 font-medium">Fees</th>
                  <th className="text-left p-3 font-medium">Tips</th>
                  <th className="text-left p-3 font-medium">Mileage</th>
                  <th className="text-left p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payouts.map(p => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <p className="font-medium">{p.driver_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{p.driver_email}</p>
                    </td>
                    <td className="p-3 text-xs">{p.week_start ? `${format(new Date(p.week_start), 'MMM d')} – ${p.week_end ? format(new Date(p.week_end), 'MMM d') : ''}` : '—'}</td>
                    <td className="p-3">{p.delivery_count || 0}</td>
                    <td className="p-3">{fmt(p.delivery_fees)}</td>
                    <td className="p-3">{fmt(p.tips)}</td>
                    <td className="p-3">{fmt(p.mileage_surcharge)}</td>
                    <td className="p-3 font-semibold">{fmt(p.total_amount)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'
                      }`}>{p.status}</span>
                      {p.error_message && <p className="text-xs text-red-600 mt-1 max-w-[160px]">{p.error_message}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : ordersLoading ? (
          <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : transferRows.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <Store className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground mt-4">No delivered orders to settle yet</p>
        </div>
      ) : (
        <div className="bg-card border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Store</th>
                <th className="text-left p-3 font-medium">Delivered Orders</th>
                <th className="text-left p-3 font-medium">Store Subtotal</th>
                <th className="text-left p-3 font-medium">Platform Fees</th>
                <th className="text-left p-3 font-medium">Stripe Connect Acct</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transferRows.map((r, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  <td className="p-3 font-medium">{r.store_name}</td>
                  <td className="p-3">{r.orders}</td>
                  <td className="p-3 font-semibold text-emerald-700">{fmt(r.subtotal)}</td>
                  <td className="p-3 text-muted-foreground">{fmt(r.fees)}</td>
                  <td className="p-3 text-xs text-muted-foreground font-mono">{r.connect_id || 'Not connected'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}