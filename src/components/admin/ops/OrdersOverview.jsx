import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, CreditCard, Store, Smartphone, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function OrdersOverview({ orders }) {
  const { buckets, recent } = orders;
  const tiles = [
    { label: 'Pending', value: buckets.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Paid', value: buckets.paid, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Waiting on Retailer', value: buckets.waiting_retailer, icon: Store, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'On Driver Device', value: buckets.on_driver, icon: Smartphone, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Delivered', value: buckets.delivered, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Failed', value: buckets.failed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Refunded', value: buckets.refunded, icon: RotateCcw, color: 'text-slate-600', bg: 'bg-slate-50' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-5 pb-4">
              <div className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg', t.bg)}>
                <t.icon className={cn('h-5 w-5', t.color)} />
              </div>
              <div className="mt-3 text-2xl font-bold">{t.value}</div>
              <div className="text-xs text-muted-foreground">{t.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <Link to="/admin/orders" className="text-xs text-primary hover:underline">View all →</Link>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Order</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Store</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Payment</th>
                <th className="py-2 pr-4 font-medium">Total</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2.5 pr-4 font-medium">{o.order_number || o.id.slice(-6)}</td>
                  <td className="py-2.5 pr-4 truncate max-w-[140px]">{o.customer_name}</td>
                  <td className="py-2.5 pr-4 truncate max-w-[120px]">{o.store_name}</td>
                  <td className="py-2.5 pr-4 capitalize text-xs">{o.status}</td>
                  <td className="py-2.5 pr-4 capitalize text-xs">{o.stripe_payment_status}</td>
                  <td className="py-2.5 pr-4">${(o.total || 0).toFixed(2)}</td>
                  <td className="py-2.5 pr-4 text-xs text-muted-foreground">{o.created_date ? new Date(o.created_date).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}