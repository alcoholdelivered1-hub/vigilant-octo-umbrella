import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Package, MapPin, Clock, Truck, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import OrderChat from '@/components/messaging/OrderChat';

const STATUS_CONFIG = {
  pending:      { label: 'Pending',      color: 'bg-slate-100 text-slate-600' },
  confirmed:    { label: 'Confirmed',    color: 'bg-blue-100 text-blue-700' },
  preparing:    { label: 'Preparing',    color: 'bg-amber-100 text-amber-700' },
  pickup_ready: { label: 'Ready for Pickup', color: 'bg-violet-100 text-violet-700' },
  in_transit:   { label: 'In Transit',   color: 'bg-primary/10 text-primary' },
  delivered:    { label: 'Delivered',    color: 'bg-emerald-100 text-emerald-700' },
};

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'];

export default function ActiveOrdersPanel({ storeId, storeName }) {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['store-active-orders', storeId],
    queryFn: () => base44.entities.Order.filter({ store_id: storeId }, '-created_date', 100),
    select: data => data.filter(o => ACTIVE_STATUSES.includes(o.status)),
    enabled: !!storeId,
    refetchInterval: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['store-active-orders', storeId] }),
  });

  const markReady = (order) => updateMutation.mutate({ id: order.id, data: { status: 'pickup_ready' } });
  const confirmOrder = (order) => updateMutation.mutate({ id: order.id, data: { status: 'confirmed' } });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading orders…
    </div>
  );

  if (orders.length === 0) return (
    <div className="text-center py-20 text-muted-foreground">
      <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">No active orders right now</p>
      <p className="text-sm mt-1">New orders will appear here automatically.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
        Live — refreshes every 15 seconds
      </div>

      {orders.map(order => {
        const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
        return (
          <div key={order.id} className="bg-card border rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-sm">{order.order_number}</span>
                <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.color)}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {order.created_date ? format(new Date(order.created_date), 'h:mm a') : '—'}
                </span>
                <span className="font-bold text-foreground text-sm">${(order.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              {/* Customer & address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Customer</p>
                  <p className="font-semibold">{order.customer_name}</p>
                  <p className="text-muted-foreground text-xs">{order.customer_phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Delivery Address</p>
                  <p className="flex items-start gap-1 text-sm">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    {order.delivery_address}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1.5">Items ({order.items?.length || 0})</p>
                <div className="space-y-1">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="text-muted-foreground">${(item.subtotal || item.price * item.quantity || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Driver info */}
              {order.driver_name && (
                <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-700 font-medium">Driver: {order.driver_name}</span>
                  {order.status === 'in_transit' && <span className="ml-auto text-xs text-blue-500">En route</span>}
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800">
                  <span className="font-medium">Note: </span>{order.notes}
                </div>
              )}

              {/* Action buttons */}
              {order.status === 'pending' && (
                <button
                  onClick={() => confirmOrder(order)}
                  disabled={updateMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {updateMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />
                  }
                  Confirm Order
                </button>
              )}

              {(order.status === 'confirmed' || order.status === 'preparing') && (
                <button
                  onClick={() => markReady(order)}
                  disabled={updateMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {updateMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <CheckCircle2 className="w-4 h-4" />
                  }
                  Mark Ready for Pickup
                </button>
              )}

              {/* Chat */}
              <details className="group">
                <summary className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none list-none py-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chat with customer / driver
                </summary>
                <div className="mt-2">
                  <OrderChat
                    orderId={order.id}
                    orderNumber={order.order_number}
                    senderRole="store"
                    senderName={storeName || 'Store'}
                  />
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}