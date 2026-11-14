import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, Star, Clock, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInMinutes, parseISO } from 'date-fns';

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={cn('w-3.5 h-3.5', star <= Math.round(rating)
            ? 'fill-amber-400 text-amber-400'
            : 'text-muted-foreground/30'
          )}
        />
      ))}
      <span className="text-xs font-semibold ml-1 text-foreground">{rating > 0 ? rating.toFixed(1) : '—'}</span>
    </div>
  );
}

export default function DriverPerformance({ storeId }) {
  const { data: deliveredOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['driver-perf-orders', storeId],
    queryFn: () => base44.entities.Order.filter({ store_id: storeId, status: 'delivered' }, '-created_date', 500),
    enabled: !!storeId,
  });

  const { data: feedback = [], isLoading: feedbackLoading } = useQuery({
    queryKey: ['driver-perf-feedback', storeId],
    queryFn: () => base44.entities.CustomerFeedback.filter({ store_id: storeId }, '-created_date', 500),
    enabled: !!storeId,
  });

  const driverStats = useMemo(() => {
    const drivers = {};

    // Aggregate delivery data per driver
    deliveredOrders.forEach(order => {
      if (!order.driver_name) return;
      const key = order.driver_name;
      if (!drivers[key]) {
        drivers[key] = { name: key, deliveries: 0, totalMinutes: 0, timedDeliveries: 0, ratings: [] };
      }
      drivers[key].deliveries += 1;

      // Calculate delivery time if both timestamps exist
      if (order.pickup_confirmed_at && order.delivery_confirmed_at) {
        const mins = differenceInMinutes(
          parseISO(order.delivery_confirmed_at),
          parseISO(order.pickup_confirmed_at)
        );
        if (mins > 0 && mins < 300) { // sanity check: ignore outliers
          drivers[key].totalMinutes += mins;
          drivers[key].timedDeliveries += 1;
        }
      }
    });

    // Attach ratings from customer feedback
    feedback.forEach(fb => {
      if (!fb.driver_name || !drivers[fb.driver_name]) return;
      drivers[fb.driver_name].ratings.push(fb.rating);
    });

    return Object.values(drivers)
      .map(d => ({
        ...d,
        avgDeliveryTime: d.timedDeliveries > 0 ? Math.round(d.totalMinutes / d.timedDeliveries) : null,
        avgRating: d.ratings.length > 0 ? d.ratings.reduce((s, r) => s + r, 0) / d.ratings.length : 0,
        reviewCount: d.ratings.length,
      }))
      .sort((a, b) => b.deliveries - a.deliveries);
  }, [deliveredOrders, feedback]);

  const isLoading = ordersLoading || feedbackLoading;

  if (isLoading) {
    return (
      <div className="bg-card border rounded-2xl p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading driver performance…
      </div>
    );
  }

  if (driverStats.length === 0) {
    return (
      <div className="bg-card border rounded-2xl p-8 text-center text-muted-foreground">
        <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No driver data yet for this store.</p>
      </div>
    );
  }

  // Top-level summary stats
  const totalDeliveries = driverStats.reduce((s, d) => s + d.deliveries, 0);
  const ratedDrivers = driverStats.filter(d => d.avgRating > 0);
  const overallRating = ratedDrivers.length > 0
    ? ratedDrivers.reduce((s, d) => s + d.avgRating, 0) / ratedDrivers.length
    : 0;
  const timedDrivers = driverStats.filter(d => d.avgDeliveryTime !== null);
  const overallAvgTime = timedDrivers.length > 0
    ? Math.round(timedDrivers.reduce((s, d) => s + d.avgDeliveryTime, 0) / timedDrivers.length)
    : null;

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b flex items-center gap-2">
        <Truck className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm">Driver Performance</h2>
        <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{driverStats.length} drivers</span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 divide-x border-b bg-muted/30">
        <div className="px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Package className="w-3 h-3" /> Total Deliveries</p>
          <p className="text-xl font-bold">{totalDeliveries}</p>
        </div>
        <div className="px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Star className="w-3 h-3" /> Avg Rating</p>
          <p className="text-xl font-bold">{overallRating > 0 ? overallRating.toFixed(1) : '—'}</p>
        </div>
        <div className="px-5 py-3 text-center">
          <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Avg Delivery Time</p>
          <p className="text-xl font-bold">{overallAvgTime ? `${overallAvgTime}m` : '—'}</p>
        </div>
      </div>

      {/* Driver table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Driver', 'Deliveries', 'Avg Time', 'Rating', 'Reviews'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {driverStats.map(driver => (
              <tr key={driver.name} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Truck className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-medium">{driver.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    <Package className="w-3 h-3" /> {driver.deliveries}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {driver.avgDeliveryTime ? (
                    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                      driver.avgDeliveryTime <= 20 ? 'bg-emerald-100 text-emerald-700' :
                      driver.avgDeliveryTime <= 35 ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      <Clock className="w-3 h-3" /> {driver.avgDeliveryTime}m
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StarRating rating={driver.avgRating} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {driver.reviewCount > 0 ? `${driver.reviewCount} review${driver.reviewCount > 1 ? 's' : ''}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
        Delivery time = pickup confirmation → delivery confirmation. Rating from customer feedback.
      </div>
    </div>
  );
}