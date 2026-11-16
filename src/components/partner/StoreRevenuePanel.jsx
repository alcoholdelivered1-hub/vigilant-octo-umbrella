import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, ShoppingBag } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

function StatCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function StoreRevenuePanel({ storeId }) {
  const [range, setRange] = useState('14');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['store-revenue-orders', storeId],
    queryFn: () => base44.entities.Order.filter({ store_id: storeId, status: 'delivered' }, '-created_date', 500),
    enabled: !!storeId,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['store-daily-reports', storeId],
    queryFn: () => base44.entities.DailyReport.filter({ store_id: storeId }, '-report_date', 60),
    enabled: !!storeId,
  });

  const days = parseInt(range);
  const cutoff = startOfDay(subDays(new Date(), days - 1));

  const filteredOrders = orders.filter(o => {
    if (!o.created_date) return false;
    return new Date(o.created_date) >= cutoff;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const avgOrder = filteredOrders.length ? totalRevenue / filteredOrders.length : 0;
  const totalItems = filteredOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0);

  // Build daily chart data
  const dailyMap = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'MMM d');
    dailyMap[d] = { date: d, revenue: 0, orders: 0 };
  }
  filteredOrders.forEach(o => {
    if (!o.created_date) return;
    const d = format(new Date(o.created_date), 'MMM d');
    if (dailyMap[d]) {
      dailyMap[d].revenue += o.total || 0;
      dailyMap[d].orders += 1;
    }
  });
  const chartData = Object.values(dailyMap);

  // DailyReport table — last 30 days from admin-generated reports
  const recentReports = reports.slice(0, 30);

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Revenue Overview</h2>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub={`Last ${days} days`} color="text-emerald-600" />
        <StatCard icon={ShoppingBag} label="Orders" value={filteredOrders.length} sub="Delivered" color="text-primary" />
        <StatCard icon={TrendingUp} label="Avg Order" value={`$${avgOrder.toFixed(2)}`} color="text-violet-600" />
      </div>

      {/* Daily revenue bar chart */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : (
        <div className="bg-card border rounded-xl p-4">
          <p className="text-sm font-semibold mb-3">Daily Revenue</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.floor(days / 7)} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Reports table from admin */}
      {recentReports.length > 0 && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold">Daily Reports</p>
            <p className="text-xs text-muted-foreground">Generated by your account manager</p>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {recentReports.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{format(parseISO(r.report_date), 'EEEE, MMM d yyyy')}</p>
                  <p className="text-xs text-muted-foreground">{r.total_orders} orders · {r.items_sold || '—'} items sold</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700">${r.total_revenue?.toFixed(2)}</p>
                  {r.avg_order_value && <p className="text-xs text-muted-foreground">avg ${r.avg_order_value?.toFixed(2)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}