import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Store, Truck, CheckCircle2, Clock, MapPin, ShieldCheck, ChevronRight, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import DriverMap from '@/components/track/DriverMap';

const STAGES = [
  {
    key: 'pending',
    label: 'Order Placed',
    sublabel: 'We received your order',
    icon: Package,
    color: 'text-slate-500',
    activeBg: 'bg-slate-100 border-slate-400',
    activeText: 'text-slate-700',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    sublabel: 'Store accepted your order',
    icon: CheckCircle2,
    color: 'text-blue-500',
    activeBg: 'bg-blue-100 border-blue-400',
    activeText: 'text-blue-700',
  },
  {
    key: 'preparing',
    label: 'Processing',
    sublabel: 'Your order is being packed',
    icon: Clock,
    color: 'text-amber-500',
    activeBg: 'bg-amber-100 border-amber-400',
    activeText: 'text-amber-700',
  },
  {
    key: 'pickup_ready',
    label: 'Ready for Pickup',
    sublabel: 'Driver is on the way to store',
    icon: Store,
    color: 'text-orange-500',
    activeBg: 'bg-orange-100 border-orange-400',
    activeText: 'text-orange-700',
  },
  {
    key: 'in_transit',
    label: 'Out for Delivery',
    sublabel: 'Your order is on its way!',
    icon: Truck,
    color: 'text-primary',
    activeBg: 'bg-primary/10 border-primary',
    activeText: 'text-primary',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    sublabel: 'Enjoy your order!',
    icon: CheckCircle2,
    color: 'text-emerald-500',
    activeBg: 'bg-emerald-100 border-emerald-500',
    activeText: 'text-emerald-700',
  },
];

const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit', 'delivered'];

const ETA_MESSAGES = {
  pending: 'Waiting for store confirmation...',
  confirmed: 'Store is preparing your order',
  preparing: 'Estimated ready in 10–15 min',
  pickup_ready: 'Driver picking up your order',
  in_transit: 'Estimated arrival in 15–25 min',
  delivered: 'Your order has been delivered!',
};

function PulsingDot() {
  return (
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
    </span>
  );
}

export default function TrackOrder() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [cancelling, setCancelling] = useState(false);
  const queryClient = useQueryClient();

  const { data: order, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['track-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const orders = await base44.entities.Order.filter({ id: orderId });
      return orders[0] || null;
    },
    enabled: !!orderId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Real-time subscription — invalidates query on any order change so map + status auto-refresh
  useEffect(() => {
    if (!orderId) return;
    const unsub = base44.entities.Order.subscribe((event) => {
      if (event.id === orderId) {
        setLastUpdated(new Date());
        // Force immediate refetch so driver GPS coords update on the map
        queryClient.invalidateQueries({ queryKey: ['track-order', orderId] });
      }
    });
    return unsub;
  }, [orderId]);

  if (!orderId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <h1 className="font-display text-2xl font-bold mt-4">Track Your Order</h1>
        <p className="text-muted-foreground mt-2">Select an order from My Orders to track it here.</p>
        <Link to="/orders"><Button variant="outline" className="mt-4">View My Orders</Button></Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-center text-muted-foreground">Order not found.</div>;
  }

  const currentIndex = STATUS_ORDER.indexOf(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'refused';
  const currentStage = STAGES.find(s => s.key === order.status);
  const isDelivered = order.status === 'delivered';
  const isInTransit = order.status === 'in_transit';
  const canCancel = ['pending', 'confirmed'].includes(order.status);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setCancelling(true);
    try {
      await base44.entities.Order.update(order.id, { status: 'cancelled' });
      queryClient.invalidateQueries({ queryKey: ['track-order', orderId] });
      toast.success('Order cancelled.');
    } catch (err) {
      toast.error('Could not cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Order</p>
          <h1 className="font-display text-2xl font-bold">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{order.store_name}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3" />
          Updated {format(lastUpdated, 'h:mm:ss a')}
        </div>
      </div>

      {/* Cancelled/Refused */}
      {isCancelled ? (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 text-center space-y-2">
          <p className="font-semibold text-destructive text-lg">
            Order {order.status === 'refused' ? 'Refused at Delivery' : 'Cancelled'}
          </p>
          {order.refusal_reason && (
            <p className="text-sm text-muted-foreground">{order.refusal_reason}</p>
          )}
          <Link to="/stores">
            <Button variant="outline" className="mt-2">Browse Stores</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Status Hero Banner */}
          <div className={cn(
            "rounded-2xl border-2 p-5 flex items-center gap-4 transition-all",
            isDelivered ? "bg-emerald-50 border-emerald-300" :
            isInTransit ? "bg-primary/5 border-primary/40" :
            "bg-card border-border"
          )}>
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0",
              isDelivered ? "bg-emerald-100" :
              isInTransit ? "bg-primary/10" :
              "bg-muted"
            )}>
              {currentStage && <currentStage.icon className={cn("w-7 h-7", currentStage.color)} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {!isDelivered && <PulsingDot />}
                <p className={cn("font-bold text-lg", isDelivered ? "text-emerald-700" : isInTransit ? "text-primary" : "text-foreground")}>
                  {currentStage?.label}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{ETA_MESSAGES[order.status]}</p>
            </div>
          </div>

          {/* Driver Map - Show when in transit */}
          {order.driver_name && order.status === 'in_transit' && (
            <DriverMap
              driverLocation={
                order.driver_current_latitude && order.driver_current_longitude
                  ? { latitude: order.driver_current_latitude, longitude: order.driver_current_longitude }
                  : null
              }
              deliveryLocation={{
                latitude: order.delivery_latitude,
                longitude: order.delivery_longitude,
                address: order.delivery_address
              }}
              driverName={order.driver_name}
              lastUpdatedAt={order.driver_location_updated_at}
            />
          )}

          {/* Timeline */}
          <div className="bg-card rounded-2xl border p-6">
            <h2 className="font-semibold mb-5 text-sm uppercase tracking-wide text-muted-foreground">Delivery Progress</h2>
            <div className="space-y-0">
              {STAGES.map((stage, i) => {
                const isDone = i < currentIndex;
                const isCurrent = i === currentIndex;
                const isPending = i > currentIndex;
                const StepIcon = stage.icon;

                return (
                  <div key={stage.key} className="flex gap-4">
                    {/* Icon + line */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                        isCurrent ? `${stage.activeBg} shadow-md scale-110` :
                        isDone ? "bg-emerald-100 border-emerald-400" :
                        "bg-muted border-border"
                      )}>
                        {isDone
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          : <StepIcon className={cn("w-4 h-4", isCurrent ? stage.color : "text-muted-foreground/40")} />
                        }
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className={cn(
                          "w-0.5 h-8 my-1 transition-all duration-500",
                          isDone ? "bg-emerald-400" : isCurrent ? "bg-primary/30" : "bg-muted"
                        )} />
                      )}
                    </div>

                    {/* Label */}
                    <div className={cn("pb-6 pt-1.5 flex-1", isPending && "opacity-35")}>
                      <p className={cn(
                        "font-semibold text-sm leading-none",
                        isCurrent ? stage.activeText : isDone ? "text-emerald-700" : "text-muted-foreground"
                      )}>
                        {stage.label}
                      </p>
                      {(isCurrent || isDone) && (
                        <p className="text-xs text-muted-foreground mt-1">{stage.sublabel}</p>
                      )}
                    </div>

                    {isCurrent && !isDelivered && (
                      <div className="pt-1.5">
                        <PulsingDot />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delivered celebration */}
          {isDelivered && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-1">
              <p className="text-2xl">🎉</p>
              <p className="font-bold text-emerald-800">Your order was delivered!</p>
              {order.delivery_confirmed_at && (
                <p className="text-xs text-emerald-600">
                  Delivered at {format(new Date(order.delivery_confirmed_at), 'h:mm a, MMM d')}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Order Details */}
      <div className="bg-card rounded-2xl border p-5 space-y-4">
        <h2 className="font-semibold">Order Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Delivery Address</p>
            <p className="font-medium mt-0.5">{order.delivery_address}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Order Total</p>
            <p className="font-bold text-base mt-0.5">${order.total?.toFixed(2)}</p>
          </div>
          {order.driver_name && (
            <div>
              <p className="text-muted-foreground text-xs">Driver</p>
              <p className="font-medium mt-0.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-primary" />{order.driver_name}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground text-xs">Items</p>
            <p className="font-medium mt-0.5">{order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Items list */}
        {order.items?.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.quantity}× {item.product_name}</span>
                <span className="font-medium">${item.subtotal?.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ID verification */}
        <div className="border-t pt-4 flex items-center gap-2 text-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="text-emerald-700 font-medium">ID Verified at checkout</span>
          {order.id_verified_at_delivery && (
            <>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-emerald-700 font-medium">& at delivery</span>
            </>
          )}
        </div>
      </div>

      {canCancel && (
        <Button
          variant="outline"
          className="w-full rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
          Cancel Order
        </Button>
      )}

      <Link to="/orders">
        <Button variant="outline" className="w-full rounded-xl">← Back to My Orders</Button>
      </Link>
    </div>
  );
}