import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Store, TrendingUp, Clock, CheckCircle2, Loader2, ShoppingBag, DollarSign, Trophy, ArrowUpDown, MapPin } from 'lucide-react';
import { subDays, parseISO, differenceInMinutes, isAfter } from 'date-fns';

const RANGES = [
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function MetricCard({ icon: Icon, label, value, sub, color = 'text-primary', bg = 'bg-primary/10' }) {
  return (
    <div className="bg-card border rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// Compute per-store metrics from raw orders
function computeStoreMetrics(orders) {
  const map = {};

  orders.forEach(order => {
    const id = order.store_id;
    if (!id) return;
    if (!map[id]) {
      map[id] = {
        id,
        name: order.store_name || id,
        total: 0,
        orders: 0,
        delivered: 0,
        cancelled: 0,
        refused: 0,
        prepTimes: [],   // minutes from created → pickup_confirmed
        revenue: 0,
      };
    }
    const s = map[id];
    s.orders++;
    s.revenue += order.total || 0;

    if (order.status === 'delivered') s.delivered++;
    if (order.status === 'cancelled') s.cancelled++;
    if (order.status === 'refused')   s.refused++;

    // Prep time: created_date → pickup_confirmed_at
    if (order.created_date && order.pickup_confirmed_at) {
      try {
        const mins = differenceInMinutes(
          parseISO(order.pickup_confirmed_at),
          parseISO(order.created_date)
        );
        if (mins > 0 && mins < 300) s.prepTimes.push(mins); // sanity: < 5h
      } catch {}
    }
  });

  return Object.values(map).map(s => ({
    ...s,
    completionRate: s.orders > 0 ? Math.round((s.delivered / s.orders) * 100) : 0,
    cancellationRate: s.orders > 0 ? Math.round(((s.cancelled + s.refused) / s.orders) * 100) : 0,
    avgPrepMins: s.prepTimes.length > 0
      ? Math.round(s.prepTimes.reduce((a, b) => a + b, 0) / s.prepTimes.length)
      : null,
    avgOrderValue: s.orders > 0 ? s.revenue / s.orders : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}

const RANK_STYLES = [
  { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: '🥇' },
  { bg: 'bg-slate-100',  text: 'text-slate-600',  border: 'border-slate-300',  label: '🥈' },
  { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: '🥉' },
];

function HubRankCard({ store, rank, sortBy }) {
  const style = RANK_STYLES[rank] || { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', label: `#${rank + 1}` };
  return (
    <div className={`bg-card border-2 ${style.border} rounded-2xl p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${style.bg}`}>
        {style.label}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{store.name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{store.orders} orders</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-emerald-700">${store.revenue.toFixed(0)}</p>
        <p className="text-xs text-muted-foreground">revenue</p>
      </div>
    </div>
  );
}

export default function StorePerformance() {
  const [rangeDays, setRangeDays] = useState(14);
  const [selectedStore, setSelectedStore] = useState('all');
  const [rankSort, setRankSort] = useState('orders'); // 'orders' | 'revenue'
  const [tableSort, setTableSort] = useState({ key: 'orders', dir: 'desc' });

  const cutoff = useMemo(() => subDays(new Date(), rangeDays), [rangeDays]);

  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['store-perf-orders', rangeDays],
    queryFn: () => base44.entities.Order.list('-created_date', 1000),
    select: data => data.filter(o => {
      try { return isAfter(parseISO(o.created_date), cutoff); } catch { return false; }
    }),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['store-perf-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 100),
  });

  const storeMetrics = useMemo(() => computeStoreMetrics(allOrders), [allOrders]);

  const filtered = useMemo(() =>
    selectedStore === 'all' ? storeMetrics : storeMetrics.filter(s => s.id === selectedStore),
    [storeMetrics, selectedStore]
  );

  // Aggregate summary across filtered stores
  const summary = useMemo(() => {
    const totalOrders = filtered.reduce((s, m) => s + m.orders, 0);
    const totalRevenue = filtered.reduce((s, m) => s + m.revenue, 0);
    const totalDelivered = filtered.reduce((s, m) => s + m.delivered, 0);
    const prepTimesAll = filtered.flatMap(m => m.prepTimes);
    const avgPrep = prepTimesAll.length > 0
      ? Math.round(prepTimesAll.reduce((a, b) => a + b, 0) / prepTimesAll.length)
      : null;
    return {
      totalOrders,
      totalRevenue,
      completionRate: totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 100) : 0,
      avgPrep,
    };
  }, [filtered]);

  // Hub rankings — all stores sorted by selected metric, top 5
  const hubRankings = useMemo(() => {
    return [...storeMetrics]
      .sort((a, b) => rankSort === 'orders' ? b.orders - a.orders : b.revenue - a.revenue)
      .slice(0, 5);
  }, [storeMetrics, rankSort]);

  // Sortable table
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mul = tableSort.dir === 'desc' ? -1 : 1;
      return (a[tableSort.key] - b[tableSort.key]) * mul;
    });
  }, [filtered, tableSort]);

  const toggleSort = (key) => {
    setTableSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      : { key, dir: 'desc' }
    );
  };

  // Chart: revenue by store
  const revenueChartData = filtered.map(s => ({
    name: s.name.length > 16 ? s.name.slice(0, 14) + '…' : s.name,
    revenue: parseFloat(s.revenue.toFixed(2)),
    orders: s.orders,
  }));

  // Chart: completion rate by store
  const completionChartData = filtered.map(s => ({
    name: s.name.length > 16 ? s.name.slice(0, 14) + '…' : s.name,
    completion: s.completionRate,
    cancellation: s.cancellationRate,
  }));

  // Chart: avg prep time
  const prepChartData = filtered.filter(s => s.avgPrepMins !== null).map(s => ({
    name: s.name.length > 16 ? s.name.slice(0, 14) + '…' : s.name,
    prepMins: s.avgPrepMins,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Store className="w-7 h-7 text-primary" /> Store Performance
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Sales volume, prep times & completion rates by store</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(rangeDays)} onValueChange={v => setRangeDays(Number(v))}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map(r => <SelectItem key={r.days} value={String(r.days)}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All Stores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard icon={ShoppingBag} label="Total Orders" value={summary.totalOrders}
              color="text-blue-600" bg="bg-blue-100" />
            <MetricCard icon={DollarSign} label="Total Revenue" value={`$${summary.totalRevenue.toFixed(2)}`}
              color="text-emerald-600" bg="bg-emerald-100" />
            <MetricCard icon={CheckCircle2} label="Completion Rate" value={`${summary.completionRate}%`}
              sub="orders delivered" color="text-green-600" bg="bg-green-100" />
            <MetricCard
              icon={Clock}
              label="Avg Prep Time"
              value={summary.avgPrep !== null ? `${summary.avgPrep} min` : 'N/A'}
              sub="order to pickup"
              color="text-amber-600"
              bg="bg-amber-100"
            />
          </div>

          {/* Hub Rankings */}
          <div className="bg-card border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" /> Busiest Delivery Hubs
              </h2>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <button
                  onClick={() => setRankSort('orders')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${rankSort === 'orders' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  By Orders
                </button>
                <button
                  onClick={() => setRankSort('revenue')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${rankSort === 'revenue' ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  By Revenue
                </button>
              </div>
            </div>
            {hubRankings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No order data for this period</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {hubRankings.map((store, i) => (
                  <HubRankCard key={store.id} store={store} rank={i} sortBy={rankSort} />
                ))}
              </div>
            )}
          </div>

          {/* Charts row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue by store */}
            <div className="bg-card border rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" /> Revenue by Store
              </h2>
              {revenueChartData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueChartData} layout="vertical" margin={{ top: 4, right: 16, left: 100, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                    <Tooltip formatter={(v, n) => n === 'revenue' ? [`$${v.toFixed(2)}`, 'Revenue'] : [v, 'Orders']} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Completion vs cancellation */}
            <div className="bg-card border rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completion Rate by Store
              </h2>
              {completionChartData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={completionChartData} layout="vertical" margin={{ top: 4, right: 16, left: 100, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                    <Tooltip formatter={v => [`${v}%`]} />
                    <Bar dataKey="completion" name="Completed" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="cancellation" name="Cancelled/Refused" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Avg prep time */}
            <div className="bg-card border rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" /> Avg Preparation Time (minutes)
              </h2>
              <p className="text-xs text-muted-foreground mb-4">Time from order placed to driver pickup confirmation</p>
              {prepChartData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No pickup confirmation data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={prepChartData} layout="vertical" margin={{ top: 4, right: 16, left: 100, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}m`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                    <Tooltip formatter={v => [`${v} min`, 'Avg Prep Time']} />
                    <Bar dataKey="prepMins" name="Avg Prep (min)" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Orders volume */}
            <div className="bg-card border rounded-2xl p-5">
              <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" /> Order Volume by Store
              </h2>
              {revenueChartData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueChartData} layout="vertical" margin={{ top: 4, right: 16, left: 100, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={95} />
                    <Tooltip />
                    <Bar dataKey="orders" name="Orders" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Per-store breakdown table */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="font-semibold text-sm">Store Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Store</th>
                    {[
                      { label: 'Orders', key: 'orders' },
                      { label: 'Revenue', key: 'revenue' },
                      { label: 'Avg Order', key: 'avgOrderValue' },
                      { label: 'Completion', key: 'completionRate' },
                      { label: 'Cancelled', key: 'cancellationRate' },
                      { label: 'Avg Prep', key: 'avgPrepMins' },
                    ].map(({ label, key }) => (
                      <th key={key} onClick={() => toggleSort(key)}
                        className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                        <span className="inline-flex items-center gap-1">
                          {label}
                          <ArrowUpDown className={`w-3 h-3 ${tableSort.key === key ? 'text-primary' : 'opacity-40'}`} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedFiltered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No data for this period</td></tr>
                  ) : sortedFiltered.map((s, i) => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium flex items-center gap-2">
                        <span className="text-base">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-xs text-muted-foreground w-5 text-center">#{i+1}</span>}</span>
                        {s.name}
                      </td>
                      <td className="px-4 py-3 font-semibold">{s.orders}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">${s.revenue.toFixed(2)}</td>
                      <td className="px-4 py-3">${s.avgOrderValue.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-muted rounded-full h-1.5 w-16 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.completionRate}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-emerald-700">{s.completionRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={s.cancellationRate > 10 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                          {s.cancellationRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.avgPrepMins !== null
                          ? <span className={s.avgPrepMins > 45 ? 'text-red-600 font-semibold' : 'text-foreground'}>{s.avgPrepMins} min</span>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
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