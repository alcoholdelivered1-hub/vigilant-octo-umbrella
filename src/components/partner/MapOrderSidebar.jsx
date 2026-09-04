import React from 'react';
import { format } from 'date-fns';
import { MapPin, Truck, Clock, CheckCircle2, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const STATUS_CONFIG = {
  pending:      { label: 'Pending',           color: 'bg-slate-100 text-slate-600' },
  confirmed:    { label: 'Confirmed',          color: 'bg-blue-100 text-blue-700' },
  preparing:    { label: 'Preparing',          color: 'bg-amber-100 text-amber-700' },
  pickup_ready: { label: 'Ready for Pickup',   color: 'bg-violet-100 text-violet-700' },
  in_transit:   { label: 'In Transit',         color: 'bg-emerald-100 text-emerald-700' },
  delivered:    { label: 'Delivered',          color: 'bg-slate-100 text-slate-500' },
};

export default function MapOrderSidebar({ orders = [], selectedOrderId, onSelectOrder, storeId }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-active-orders', storeId] }),
  });

  const markReady = (order) => updateMutation.mutate({ id: order.id, data: { status: 'pickup_ready' } });

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
        <Package className="w-10 h-10 mb-3 opacity-20" />
        <p className="font-medium text-sm">No active orders</p>
        <p className="text-xs mt-1">New orders appear here in real time.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-3 border-b flex items-center gap-2 sticky top-0 bg-card z-10">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-xs text-muted-foreground font-medium">{orders.length} active order{orders.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y flex-1">
        {orders.map(order => {
          const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
          const isSelected = selectedOrderId === order.id;
          const hasGPS = !!(order.delivery_latitude && order.delivery_longitude);
          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder(isSelected ? null : order.id)}
              className={cn(
                'px-4 py-3.5 cursor-pointer transition-colors',
                isSelected ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-muted/40 border-l-2 border-transparent'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm">#{order.order_number}</span>
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color)}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate">{order.customer_name}</p>
                  <div className="flex items-start gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{order.delivery_address}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">${(order.total || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.created_date ? format(new Date(order.created_date), 'h:mm a') : '—'}
                  </p>
                  {!hasGPS && <p className="text-xs text-amber-500 mt-0.5">no GPS</p>}
                </div>
              </div>

              {order.driver_name && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-blue-600">
                  <Truck className="w-3 h-3" />
                  <span>{order.driver_name}</span>
                  {order.status === 'in_transit' && <span className="text-emerald-600 ml-1">• Live</span>}
                </div>
              )}

              {(order.status === 'confirmed' || order.status === 'preparing') && (
                <button
                  onClick={(e) => { e.stopPropagation(); markReady(order); }}
                  disabled={updateMutation.isPending}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {updateMutation.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <CheckCircle2 className="w-3 h-3" />
                  }
                  Mark Ready for Pickup
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}