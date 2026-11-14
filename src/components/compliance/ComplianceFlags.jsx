import React, { useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ShieldOff, UserX, MapPin, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// --- Flag logic ---
function getFlagsForOrder(order, drivers, verifications) {
  const flags = [];

  // Missing ID verification at checkout
  const hasCheckoutVerif = verifications.some(
    v => v.order_id === order.id && v.verification_type === 'checkout' && v.is_verified
  );
  if (!hasCheckoutVerif && ['confirmed', 'preparing', 'pickup_ready', 'in_transit', 'delivered'].includes(order.status)) {
    flags.push({ type: 'missing_checkout_id', severity: 'high', label: 'No Checkout ID Verification' });
  }

  // Missing ID verification at delivery
  const hasDeliveryVerif = verifications.some(
    v => v.order_id === order.id && v.verification_type === 'delivery' && v.is_verified
  );
  if (!hasDeliveryVerif && order.status === 'delivered') {
    flags.push({ type: 'missing_delivery_id', severity: 'high', label: 'No Delivery ID Verification' });
  }

  // Dry county / illegal zone
  if (order.is_in_legal_zone === false) {
    flags.push({ type: 'dry_county', severity: 'critical', label: 'Delivered to Dry County / Illegal Zone' });
  }

  // Driver not certified
  if (order.driver_id) {
    const driver = drivers.find(d => d.id === order.driver_id);
    if (driver && !driver.training_completed) {
      flags.push({ type: 'uncertified_driver', severity: 'high', label: 'Driver Not ACT 157 Certified' });
    }
  }

  return flags;
}

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-600', row: 'bg-red-50/40' },
  high: { color: 'bg-amber-100 text-amber-800 border-amber-300', dot: 'bg-amber-500', row: 'bg-amber-50/30' },
};

const FLAG_ICONS = {
  missing_checkout_id: ShieldOff,
  missing_delivery_id: ShieldOff,
  dry_county: MapPin,
  uncertified_driver: UserX,
};

export default function ComplianceFlags({ orders, drivers, verifications }) {
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  // Build flagged orders list
  const flaggedOrders = orders
    .filter(o => !['cancelled'].includes(o.status))
    .map(order => ({
      order,
      flags: getFlagsForOrder(order, drivers, verifications),
    }))
    .filter(({ flags }) => flags.length > 0);

  const criticalCount = flaggedOrders.filter(({ flags }) => flags.some(f => f.severity === 'critical')).length;
  const highCount = flaggedOrders.filter(({ flags }) => flags.every(f => f.severity !== 'critical')).length;

  const filtered = filter === 'all' ? flaggedOrders
    : flaggedOrders.filter(({ flags }) => flags.some(f => f.severity === filter));

  const display = showAll ? filtered : filtered.slice(0, 15);

  return (
    <div className="bg-card rounded-2xl border">
      {/* Header */}
      <div className="p-5 border-b flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Active Compliance Flags
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Orders with missing ID verification, uncertified drivers, or dry county violations
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {criticalCount > 0 && (
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 font-semibold">
              🚨 {criticalCount} Critical
            </Badge>
          )}
          {highCount > 0 && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-semibold">
              ⚠️ {highCount} High
            </Badge>
          )}
          {flaggedOrders.length === 0 && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              ✅ All Clear
            </Badge>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      {flaggedOrders.length > 0 && (
        <div className="px-5 pt-4 flex gap-2">
          {['all', 'critical', 'high'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                filter === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              {f === 'all' ? `All (${flaggedOrders.length})` : f === 'critical' ? `Critical (${criticalCount})` : `High (${highCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {flaggedOrders.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="font-semibold text-emerald-700">No compliance flags</p>
          <p className="text-xs text-muted-foreground">All orders have passed ID verification, driver certification, and zone checks.</p>
        </div>
      ) : (
        <>
          <div className="divide-y mt-3">
            {display.map(({ order, flags }) => (
              <div key={order.id} className={cn('p-4', flags.some(f => f.severity === 'critical') ? 'bg-red-50/30' : 'bg-amber-50/20')}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{order.order_number || `#${order.id.slice(-6)}`}</span>
                      <Badge variant="outline" className="text-xs capitalize">{order.status}</Badge>
                      {order.store_name && <span className="text-xs text-muted-foreground">{order.store_name}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      👤 {order.customer_name} · 🚗 {order.driver_name || 'Unassigned'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      📍 {order.delivery_address || 'No address'}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0">
                    {order.created_date ? format(new Date(order.created_date), 'MMM d, h:mm a') : ''}
                  </p>
                </div>
                {/* Flag chips */}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {flags.map((flag, i) => {
                    const Icon = FLAG_ICONS[flag.type] || AlertTriangle;
                    const cfg = SEVERITY_CONFIG[flag.severity];
                    return (
                      <span key={i} className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium', cfg.color)}>
                        <Icon className="w-3 h-3" />
                        {flag.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {filtered.length > 15 && (
            <div className="p-3 border-t text-center">
              <button onClick={() => setShowAll(s => !s)} className="text-xs text-primary hover:underline">
                {showAll ? 'Show less' : `Show all ${filtered.length} flagged orders`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}