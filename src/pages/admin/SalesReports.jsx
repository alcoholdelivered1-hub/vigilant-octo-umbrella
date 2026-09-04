import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, DollarSign, ShoppingBag, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

const RANGES = [
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
];

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border rounded-2xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function SalesReports() {
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] = useState(14);
  const [selectedStore, setSelectedStore] = useState('all');

  const cutoff = subDays(new Date(), rangeDays).toISOString().split('T')[0];

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['daily-reports', rangeDays],
    queryFn: () => base44.entities.DailyReport.filter({}, '-report_date', 200),
    select: (data) => data.filter(r => r.report_date >= cutoff),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['stores-list'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 100),
  });

  const recalcMutation = useMutation({
    mutationFn: () => base44.functions.invoke('calculateDailySales', { date: format(subDays(new Date(), 1), 'yyyy-MM-dd') }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-reports'] });
      toast.success('Yesterday\'s report recalculated!');
    },
    onError: () => toast.error('Failed to recalculate. Make sure you are an admin.'),
  });

  // Filter by store
  const filtered = selectedStore === 'all'
    ? reports
    : reports.filter(r => r.store_id === selectedStore);

  // Aggregate by date for chart
  const byDate = filtered.reduce((acc, r) => {
    const d = r.report_date;
    if (!acc[d]) acc[d] = { date: d, revenue: 0, orders: 0 };
    acc[d].revenue += r.total_revenue || 0;
    acc[d].orders  += r.total_orders || 0;
    return acc;
  }, {});
  const chartData = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({ ...d, date: format(new Date(d.date + 'T12:00:00'), 'MMM d'), revenue: parseFloat(d.revenue.toFixed(2)) }));

  // Per-store bar data (latest period totals)
  const byStore = filtered.reduce((acc, r) => {
    const name = r.store_name || r.store_id;
    if (!acc[name]) acc[name] = { store: name, revenue: 0 };
    acc[name].revenue += r.total_revenue || 0;
    return acc;
  }, {});
  const storeBarData = Object.values(byStore).sort((a, b) => b.revenue - a.revenue);

  // Summary stats
  const totalRevenue = filtered.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalOrders  = filtered.reduce((s, r) => s + (r.total_orders || 0), 0);
  const avgOrderVal  = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Sales Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Daily revenue by store</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map(r => (
                <SelectItem key={r.days} value={String(r.days)}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="All Stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
            className="h-9 gap-1.5"
          >
            {recalcMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Recalculate
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="bg-emerald-100 text-emerald-700" />
        <StatCard icon={ShoppingBag} label="Total Orders" value={totalOrders} color="bg-blue-100 text-blue-700" />
        <StatCard icon={TrendingUp} label="Avg Order Value" value={`$${avgOrderVal.toFixed(2)}`} color="bg-amber-100 text-amber-700" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading reports...
        </div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No report data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click "Recalculate" to generate yesterday's report, or wait for the nightly automation.</p>
        </div>
      ) : (
        <>
          {/* Revenue Over Time */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="font-semibold text-sm mb-4">Daily Revenue</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v) => [`$${v}`, 'Revenue']} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Orders Over Time */}
          <div className="bg-card border rounded-2xl p-5">
            <h2 className="font-semibold text-sm mb-4">Daily Orders</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue by Store */}
          {storeBarData.length > 1 && (
            <div className="bg-card border rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-4">Revenue by Store</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={storeBarData} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="store" tick={{ fontSize: 11 }} width={75} />
                  <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="font-semibold text-sm">Report Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {['Date', 'Store', 'Revenue', 'Orders', 'Avg Order', 'Items Sold'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.sort((a, b) => b.report_date.localeCompare(a.report_date)).map(r => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{r.report_date}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.store_name}</td>
                      <td className="px-4 py-2.5 font-semibold text-emerald-700">${(r.total_revenue || 0).toFixed(2)}</td>
                      <td className="px-4 py-2.5">{r.total_orders || 0}</td>
                      <td className="px-4 py-2.5">${(r.avg_order_value || 0).toFixed(2)}</td>
                      <td className="px-4 py-2.5">{r.items_sold || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}