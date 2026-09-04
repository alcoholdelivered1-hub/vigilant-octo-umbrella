import React, { useState } from 'react';
import { format } from 'date-fns';
import { MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Orders flagged as borderline: is_in_legal_zone === false, or no GPS data on order
function getRiskLevel(order) {
  if (order.is_in_legal_zone === false) return 'illegal';
  if (!order.delivery_latitude || !order.delivery_longitude) return 'unverified';
  if (!order.order_latitude || !order.order_longitude) return 'no-gps';
  return 'ok';
}

const RISK_CONFIG = {
  illegal: { label: 'Flagged — Outside Legal Zone', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  unverified: { label: 'No Delivery GPS', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'no-gps': { label: 'No Order GPS', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  ok: { label: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

export default function BorderlineDeliveries({ orders }) {
  const [showAll, setShowAll] = useState(false);

  const flagged = orders.filter(o => getRiskLevel(o) !== 'ok' && o.status !== 'cancelled');
  const illegal = flagged.filter(o => getRiskLevel(o) === 'illegal');
  const unverified = flagged.filter(o => getRiskLevel(o) !== 'illegal');

  const display = showAll ? flagged : flagged.slice(0, 10);

  return (
    <div className="bg-card rounded-2xl border">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-red-500" />
            Borderline / Jurisdiction Deliveries
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Orders flagged for wet/dry zone compliance review</p>
        </div>
        <div className="flex gap-2">
          {illegal.length > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-semibold">
              {illegal.length} Illegal Zone
            </Badge>
          )}
          {unverified.length > 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-semibold">
              {unverified.length} Unverified GPS
            </Badge>
          )}
          {flagged.length === 0 && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">All Clear</Badge>
          )}
        </div>
      </div>

      {flagged.length === 0 ? (
        <div className="p-8 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="font-medium text-emerald-700">No jurisdiction flags</p>
          <p className="text-xs text-muted-foreground">All recent deliveries were confirmed in legal wet zones</p>
        </div>
      ) : (
        <>
          <div className="divide-y">
            {display.map(order => {
              const risk = getRiskLevel(order);
              const cfg = RISK_CONFIG[risk];
              return (
                <div key={order.id} className={`p-4 flex items-start gap-3 ${risk === 'illegal' ? 'bg-red-50/30' : risk !== 'ok' ? 'bg-amber-50/20' : ''}`}>
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{order.order_number || order.id.slice(-8)}</span>
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{order.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      📍 {order.delivery_address || 'No address on record'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Customer: {order.customer_name} · Driver: {order.driver_name || 'Unassigned'}
                      {order.store_name && ` · Store: ${order.store_name}`}
                    </p>
                    {order.delivery_latitude && (
                      <p className="text-xs text-muted-foreground font-mono">
                        GPS: {order.delivery_latitude.toFixed(4)}, {order.delivery_longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {order.created_date ? format(new Date(order.created_date), 'MMM d, h:mm a') : ''}
                    </p>
                    {risk === 'illegal' && (
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-1 ml-auto" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {flagged.length > 10 && (
            <div className="p-3 border-t text-center">
              <button onClick={() => setShowAll(s => !s)} className="text-xs text-primary hover:underline">
                {showAll ? 'Show less' : `Show all ${flagged.length} flagged orders`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}