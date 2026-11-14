import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Clock, Calendar, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { subDays, subHours, parseISO, getHours } from 'date-fns';
import OrderHeatmap from '@/components/admin/OrderHeatmap';

const TIME_FILTERS = [
  { label: 'Last 6h',  value: '6h' },
  { label: 'Last 24h', value: '24h' },
  { label: 'Last 7d',  value: '7d' },
  { label: 'Last 30d', value: '30d' },
];

const HOUR_BLOCKS = [
  { label: 'Morning (6–12)', hours: [6,7,8,9,10,11] },
  { label: 'Afternoon (12–17)', hours: [12,13,14,15,16] },
  { label: 'Evening (17–22)', hours: [17,18,19,20,21] },
  { label: 'Night (22–6)', hours: [22,23,0,1,2,3,4,5] },
];

function filterByTime(orders, range) {
  const now = new Date();
  const cutoff = {
    '6h':  subHours(now, 6),
    '24h': subHours(now, 24),
    '7d':  subDays(now, 7),
    '30d': subDays(now, 30),
  }[range];
  return orders.filter(o => {
    try { return parseISO(o.created_date) >= cutoff; } catch { return false; }
  });
}

function HourBar({ label, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-8 text-right">{count}</span>
    </div>
  );
}

export default function DemandHeatmap() {
  const [timeRange, setTimeRange] = useState('24h');
  const [hourFilter, setHourFilter] = useState('all');

  const { data: allOrders = [], isLoading } = useQuery({
    queryKey: ['heatmap-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
  });

  const timeFiltered = useMemo(() => filterByTime(allOrders, timeRange), [allOrders, timeRange]);

  const hourFiltered = useMemo(() => {
    if (hourFilter === 'all') return timeFiltered;
    const block = HOUR_BLOCKS.find(b => b.label === hourFilter);
    if (!block) return timeFiltered;
    return timeFiltered.filter(o => {
      try { return block.hours.includes(getHours(parseISO(o.created_date))); } catch { return false; }
    });
  }, [timeFiltered, hourFilter]);

  // Build hourly breakdown chart data
  const hourlyBreakdown = useMemo(() => {
    const counts = Array(24).fill(0);
    timeFiltered.forEach(o => {
      try { counts[getHours(parseISO(o.created_date))]++; } catch {}
    });
    return counts;
  }, [timeFiltered]);

  const blockTotals = useMemo(() => HOUR_BLOCKS.map(b => ({
    label: b.label,
    count: b.hours.reduce((sum, h) => sum + hourlyBreakdown[h], 0),
  })), [hourlyBreakdown]);

  const maxBlock = Math.max(...blockTotals.map(b => b.count), 1);
  const peakBlock = blockTotals.reduce((a, b) => b.count > a.count ? b : a, blockTotals[0]);

  const ordersWithGPS = hourFiltered.filter(o => (o.order_latitude || o.delivery_latitude));

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link to="/admin/live-map" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Live Map
          </Link>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Flame className="w-7 h-7 text-orange-500" /> Demand Heatmap
          </h1>
          <p className="text-muted-foreground mt-1">Order origin clusters by time period — identify peak zones for drivers</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-1 bg-card border rounded-xl p-1">
            <Calendar className="w-4 h-4 text-muted-foreground ml-2" />
            {TIME_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setTimeRange(f.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === f.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-card border rounded-xl p-1">
            <Clock className="w-4 h-4 text-muted-foreground ml-2" />
            <button
              onClick={() => setHourFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                hourFilter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Hours
            </button>
            {HOUR_BLOCKS.map(b => (
              <button
                key={b.label}
                onClick={() => setHourFilter(b.label)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  hourFilter === b.label ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {b.label.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Orders in Period', value: timeFiltered.length, color: 'text-primary' },
            { label: 'Plotted on Map', value: ordersWithGPS.length, color: 'text-blue-600' },
            { label: 'Peak Period', value: peakBlock?.label?.split(' ')[0] || '—', color: 'text-orange-500' },
            { label: 'Peak Orders', value: peakBlock?.count || 0, color: 'text-orange-500' },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Map + sidebar */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="h-[480px] bg-muted rounded-xl animate-pulse flex items-center justify-center text-muted-foreground text-sm">
                Loading orders…
              </div>
            ) : ordersWithGPS.length === 0 ? (
              <div className="h-[480px] bg-card border rounded-xl flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Flame className="w-10 h-10 opacity-30" />
                <p className="text-sm">No orders with GPS coordinates in this period.</p>
                <p className="text-xs">Orders need <code>order_latitude</code> or <code>delivery_latitude</code> to appear.</p>
              </div>
            ) : (
              <OrderHeatmap orders={hourFiltered} height="480px" />
            )}
          </div>

          {/* Sidebar: time-of-day breakdown */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" /> Orders by Time Block
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockTotals.map(b => (
                  <HourBar key={b.label} label={b.label} count={b.count} max={maxBlock} />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Hourly Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-6 gap-1">
                  {hourlyBreakdown.map((count, h) => {
                    const maxH = Math.max(...hourlyBreakdown, 1);
                    const pct = (count / maxH) * 100;
                    return (
                      <div key={h} className="flex flex-col items-center gap-1">
                        <div className="w-full h-16 bg-muted rounded-sm relative overflow-hidden flex items-end">
                          <div
                            className="w-full bg-primary/70 rounded-sm transition-all"
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" /> Driver Tip
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Position yourself near <strong>high-demand (red) zones</strong> during peak hours to maximize order acceptance rate and minimize travel distance.
                </p>
                {peakBlock && (
                  <p className="text-xs text-orange-700 mt-1">
                    Peak demand today: <strong>{peakBlock.label}</strong> with {peakBlock.count} orders.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}