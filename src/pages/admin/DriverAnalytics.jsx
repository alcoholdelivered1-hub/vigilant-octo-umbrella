import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { DollarSign, Truck, Star, Loader2, Users } from 'lucide-react';
import StarRating from '@/components/shared/StarRating';
import { cn } from '@/lib/utils';

function SummaryCard({ icon: Icon, label, value, color = 'bg-primary/10 text-primary' }) {
  return (
    <div className="bg-card border rounded-2xl p-5 flex items-center gap-4">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

export default function DriverAnalytics() {
  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ['analytics-drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['analytics-orders'],
    queryFn: () => base44.entities.Order.filter({ status: 'delivered' }, '-created_date', 1000),
  });

  const { data: ratings = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ['analytics-ratings'],
    queryFn: () => base44.entities.DriverRating.list(),
  });

  const driverStats = useMemo(() => {
    return drivers.map(driver => {
      const driverOrders = orders.filter(o => o.driver_id === driver.id);
      const driverRatings = ratings.filter(r => r.driver_id === driver.id);

      const totalDeliveries = driverOrders.length;
      const totalEarnings = driverOrders.reduce(
        (sum, o) => sum + (o.delivery_fee || 3) + (o.tip || 0), 0
      );
      const avgRating = driverRatings.length > 0
        ? driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length
        : null;

      return { ...driver, totalDeliveries, totalEarnings, avgRating, ratingCount: driverRatings.length };
    }).sort((a, b) => b.totalDeliveries - a.totalDeliveries);
  }, [drivers, orders, ratings]);

  const totals = useMemo(() => ({
    drivers: drivers.length,
    deliveries: orders.length,
    earnings: orders.reduce((sum, o) => sum + (o.delivery_fee || 3) + (o.tip || 0), 0),
    avgRating: ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0,
  }), [drivers, orders, ratings]);

  const isLoading = driversLoading || ordersLoading || ratingsLoading;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Driver Analytics</h1>
        <p className="text-muted-foreground mt-1">Performance overview across all drivers</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={Users} label="Total Drivers" value={totals.drivers} color="bg-blue-100 text-blue-700" />
        <SummaryCard icon={Truck} label="Total Deliveries" value={totals.deliveries} color="bg-emerald-100 text-emerald-700" />
        <SummaryCard icon={DollarSign} label="Total Driver Earnings" value={`$${totals.earnings.toFixed(2)}`} color="bg-violet-100 text-violet-700" />
        <SummaryCard icon={Star} label="Platform Avg Rating" value={totals.avgRating ? totals.avgRating.toFixed(1) + ' ★' : '—'} color="bg-amber-100 text-amber-700" />
      </div>

      {/* Driver table */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/50">
          <h2 className="font-semibold text-sm">Driver Performance Breakdown</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
          </div>
        ) : driverStats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">No drivers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Driver</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Total Deliveries</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Avg Rating</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Total Earnings</th>
                  <th className="text-left px-5 py-3 font-semibold text-xs text-muted-foreground">Delivery Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {driverStats.map(driver => {
                  const maxDeliveries = driverStats[0]?.totalDeliveries || 1;
                  const pct = Math.round((driver.totalDeliveries / maxDeliveries) * 100);
                  const statusColors = {
                    available: 'bg-emerald-100 text-emerald-700',
                    on_delivery: 'bg-blue-100 text-blue-700',
                    offline: 'bg-muted text-muted-foreground',
                    suspended: 'bg-red-100 text-red-700',
                  };
                  return (
                    <tr key={driver.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">{driver.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', statusColors[driver.status] || 'bg-muted text-muted-foreground')}>
                          {(driver.status || 'offline').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-base">{driver.totalDeliveries}</td>
                      <td className="px-5 py-3">
                        {driver.avgRating != null ? (
                          <div className="flex items-center gap-1.5">
                            <StarRating value={driver.avgRating} size="sm" showValue />
                            <span className="text-xs text-muted-foreground">({driver.ratingCount})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No ratings yet</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold text-emerald-700">${driver.totalEarnings.toFixed(2)}</td>
                      <td className="px-5 py-3 w-36">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{pct}% of top</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}