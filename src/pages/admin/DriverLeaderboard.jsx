import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Trophy, Truck, DollarSign, Star, TrendingUp,
  RefreshCw, Loader2, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

const PERIODS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

const SORT_OPTIONS = [
  { label: 'Deliveries', value: 'deliveries' },
  { label: 'Mileage Earnings', value: 'mileage' },
  { label: 'Total Miles', value: 'miles' },
  { label: 'Tips Earned', value: 'tips' },
  { label: 'Avg Rating', value: 'rating' },
];

function inPeriod(dateStr, period) {
  try {
    const d = parseISO(dateStr);
    if (period === 'today') return isToday(d);
    if (period === 'week') return isThisWeek(d, { weekStartsOn: 1 });
    if (period === 'month') return isThisMonth(d);
    return true;
  } catch { return false; }
}

const MEDAL = [
  { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700', emoji: '🥇' },
  { bg: 'bg-slate-100',  border: 'border-slate-300',  text: 'text-slate-600',  emoji: '🥈' },
  { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', emoji: '🥉' },
];

function RankBadge({ rank }) {
  if (rank < 3) {
    const m = MEDAL[rank];
    return (
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border-2 flex-shrink-0 ${m.bg} ${m.border}`}>
        {m.emoji}
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-muted-foreground bg-muted flex-shrink-0">
      #{rank + 1}
    </div>
  );
}

function StatChip({ icon: Icon, label, value, color = 'text-muted-foreground' }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className={`w-3 h-3 flex-shrink-0 ${color}`} />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className={`text-xs font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function BarFill({ value, max, color = 'bg-primary' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DriverLeaderboard() {
  const [period, setPeriod] = useState('week');
  const [sortBy, setSortBy] = useState('deliveries');

  const { data: orders = [], isLoading: ordersLoading, refetch, isFetching } = useQuery({
    queryKey: ['leaderboard-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 3000),
    refetchInterval: 120000,
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['leaderboard-drivers'],
    queryFn: () => base44.entities.Driver.filter({ is_active: true }, 'name', 200),
  });

  const isLoading = ordersLoading || driversLoading;

  // Only delivered orders in the period
  const periodOrders = useMemo(() =>
    orders.filter(o => o.status === 'delivered' && o.driver_id && inPeriod(o.created_date, period)),
    [orders, period]
  );

  // Aggregate per driver
  const leaderboard = useMemo(() => {
    const map = {};
    for (const o of periodOrders) {
      if (!map[o.driver_id]) {
        map[o.driver_id] = { deliveries: 0, totalMiles: 0, mileageEarnings: 0, tips: 0 };
      }
      const m = map[o.driver_id];
      m.deliveries++;
      const miles = parseFloat(o.distance_miles) || 0;
      m.totalMiles += miles;
      m.mileageEarnings += parseFloat(o.mileage_surcharge) || 0;
      m.tips += parseFloat(o.tip) || 0;
    }

    return drivers.map(driver => {
      const stats = map[driver.id] || { deliveries: 0, totalMiles: 0, mileageEarnings: 0, tips: 0 };
      return {
        ...driver,
        ...stats,
        avgMilesPerDelivery: stats.deliveries > 0 ? stats.totalMiles / stats.deliveries : 0,
        totalEarnings: (stats.deliveries * 3) + stats.mileageEarnings + stats.tips,
      };
    }).sort((a, b) => {
      if (sortBy === 'deliveries') return b.deliveries - a.deliveries;
      if (sortBy === 'mileage') return b.mileageEarnings - a.mileageEarnings;
      if (sortBy === 'miles') return b.totalMiles - a.totalMiles;
      if (sortBy === 'tips') return b.tips - a.tips;
      if (sortBy === 'rating') return (b.avg_rating || 0) - (a.avg_rating || 0);
      return 0;
    });
  }, [drivers, periodOrders, sortBy]);

  // Only show drivers with at least 1 delivery first, then inactive ones below
  const active = leaderboard.filter(d => d.deliveries > 0);
  const inactive = leaderboard.filter(d => d.deliveries === 0);

  const maxDeliveries = Math.max(...leaderboard.map(d => d.deliveries), 1);
  const maxMileage = Math.max(...leaderboard.map(d => d.mileageEarnings), 1);

  // Summary totals
  const totals = useMemo(() => ({
    deliveries: active.reduce((s, d) => s + d.deliveries, 0),
    mileageEarnings: active.reduce((s, d) => s + d.mileageEarnings, 0),
    totalMiles: active.reduce((s, d) => s + d.totalMiles, 0),
    tips: active.reduce((s, d) => s + d.tips, 0),
  }), [active]);

  const periodLabel = PERIODS.find(p => p.value === period)?.label || '';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-500" /> Driver Leaderboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Top performing drivers by deliveries and earnings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <div className="flex bg-muted rounded-xl p-1 gap-0.5">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${period === p.value ? 'bg-white shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `${periodLabel} Deliveries`, value: totals.deliveries, icon: Truck, bg: 'bg-primary/10', color: 'text-primary' },
          { label: 'Mileage Paid Out', value: `$${totals.mileageEarnings.toFixed(2)}`, icon: DollarSign, bg: 'bg-amber-100', color: 'text-amber-600' },
          { label: 'Total Miles Driven', value: `${totals.totalMiles.toFixed(1)} mi`, icon: MapPin, bg: 'bg-blue-100', color: 'text-blue-600' },
          { label: 'Tips Earned', value: `$${totals.tips.toFixed(2)}`, icon: TrendingUp, bg: 'bg-emerald-100', color: 'text-emerald-600' },
        ].map(card => (
          <div key={card.label} className="bg-card border rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-lg font-bold tabular-nums">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sort control */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{active.length} drivers with deliveries {periodLabel.toLowerCase()}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Rank by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading leaderboard…
        </div>
      ) : active.length === 0 ? (
        <div className="bg-muted/40 border rounded-2xl p-12 text-center space-y-2">
          <Truck className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-semibold text-muted-foreground">No deliveries recorded {periodLabel.toLowerCase()}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((driver, i) => (
            <div
              key={driver.id}
              className={`bg-card border rounded-2xl p-4 flex items-center gap-4 transition-shadow hover:shadow-md ${i === 0 ? 'border-yellow-300 shadow-yellow-100 shadow-sm' : i === 1 ? 'border-slate-300' : i === 2 ? 'border-orange-300' : ''}`}
            >
              <RankBadge rank={i} />

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary flex-shrink-0">
                {driver.name?.[0]?.toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{driver.name}</p>
                  {driver.avg_rating > 0 && (
                    <div className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium text-amber-600">{driver.avg_rating.toFixed(1)}</span>
                    </div>
                  )}
                  {driver.status === 'on_delivery' && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">On Delivery</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <StatChip icon={Truck} label="Deliveries" value={driver.deliveries} color="text-primary" />
                  <StatChip icon={MapPin} label="Miles" value={`${driver.totalMiles.toFixed(1)}`} color="text-blue-600" />
                  <StatChip icon={DollarSign} label="Mileage bonus" value={`$${driver.mileageEarnings.toFixed(2)}`} color="text-amber-600" />
                  <StatChip icon={TrendingUp} label="Tips" value={`$${driver.tips.toFixed(2)}`} color="text-emerald-600" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Deliveries</p>
                    <BarFill value={driver.deliveries} max={maxDeliveries} color="bg-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Mileage Earnings</p>
                    <BarFill value={driver.mileageEarnings} max={maxMileage} color="bg-amber-400" />
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0 hidden sm:block">
                <p className="text-xs text-muted-foreground">Total Earnings</p>
                <p className="text-lg font-bold text-emerald-700">${driver.totalEarnings.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">(fees + mileage + tips)</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inactive drivers */}
      {inactive.length > 0 && (
        <div className="bg-muted/30 border border-dashed rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">No deliveries {periodLabel.toLowerCase()} ({inactive.length} drivers)</p>
          <div className="flex flex-wrap gap-2">
            {inactive.map(d => (
              <span key={d.id} className="text-xs bg-muted px-2 py-1 rounded-lg text-muted-foreground">{d.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}