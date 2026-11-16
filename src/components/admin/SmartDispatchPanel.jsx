import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateDistance } from '@/lib/distanceUtils';
import {
  Zap, Truck, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, AlertTriangle, User, Radio
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const PINE_BLUFF = { lat: 34.2284, lng: -92.0032 };
const CAPACITY = { car: 3, suv: 4, truck: 5, van: 6, motorcycle: 2 };

function getCapacity(driver) {
  const info = (driver.vehicle_info || '').toLowerCase();
  for (const [type, limit] of Object.entries(CAPACITY)) {
    if (info.includes(type)) return limit;
  }
  return 3;
}

function rankDrivers(drivers, order, activeOrders) {
  const oLat = order.delivery_latitude || order.order_latitude || PINE_BLUFF.lat;
  const oLng = order.delivery_longitude || order.order_longitude || PINE_BLUFF.lng;

  return drivers
    .filter(d => (d.status === 'available' || d.status === 'on_delivery') && d.training_completed === true && d.background_check_status === 'clear')
    .map(d => {
      const dLat = d.current_latitude || PINE_BLUFF.lat;
      const dLng = d.current_longitude || PINE_BLUFF.lng;
      const dist = parseFloat(calculateDistance(dLat, dLng, oLat, oLng).toFixed(1));
      const load = activeOrders.filter(o => o.driver_id === d.id).length;
      const cap = getCapacity(d);
      if (load >= cap) return null;
      return { driver: d, dist, load, cap, score: dist + load * 4 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
}

function DriverOption({ candidate, selected, onClick }) {
  const { driver, dist, load, cap, score } = candidate;
  const hasGPS = !!(driver.current_latitude);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border hover:border-primary/40 hover:bg-muted/30'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${driver.status === 'available' ? 'bg-emerald-500' : 'bg-blue-400'}`} />
        <span className="font-medium truncate">{driver.name}</span>
        {hasGPS && <Radio className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
        <span className="text-xs text-muted-foreground">{load}/{cap} orders</span>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <span className="text-xs font-semibold text-primary">{dist} mi</span>
        <span className="text-[10px] text-muted-foreground block">score {score.toFixed(1)}</span>
      </div>
    </button>
  );
}

function OrderCard({ order, drivers, activeOrders }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);

  const ranked = rankDrivers(drivers, order, activeOrders);
  const best = ranked[0];

  // Auto-select best on mount
  useEffect(() => { if (best) setSelected(best.driver.id); }, [best?.driver.id]);

  const assignMutation = useMutation({
    mutationFn: ({ driverId, driverEmail, driverName }) =>
      base44.entities.Order.update(order.id, {
        driver_id: driverId,
        driver_email: driverEmail,
        driver_name: driverName,
        status: order.status,
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['smart-dispatch-orders'] });
      queryClient.invalidateQueries({ queryKey: ['smart-dispatch-drivers'] });
      toast.success(`${order.order_number} → ${vars.driverName}`);
    },
    onError: () => toast.error('Assignment failed'),
  });

  const handleApprove = () => {
    const candidate = ranked.find(c => c.driver.id === selected) || best;
    if (!candidate) return;
    assignMutation.mutate({ driverId: candidate.driver.id, driverEmail: candidate.driver.email, driverName: candidate.driver.name });
  };

  const age = order.created_date
    ? formatDistanceToNow(new Date(order.created_date), { addSuffix: true })
    : '—';

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4 text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{order.order_number}</p>
            <p className="text-xs text-muted-foreground truncate">{order.store_name} · {age}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-bold text-sm">${order.total?.toFixed(2)}</span>
          <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-800 capitalize">
            {order.status}
          </Badge>
        </div>
      </div>

      {/* Delivery address */}
      <div className="px-4 pb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{order.delivery_address}</span>
        <span className="ml-auto font-medium text-foreground flex-shrink-0">{order.customer_name}</span>
      </div>

      {/* Best match + approve */}
      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        {best ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <Zap className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
            <span className="truncate">
              Best: <strong>{best.driver.name}</strong> · {best.dist} mi · {best.load} active
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" /> No available drivers
          </div>
        )}

        <div className="flex gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            className="h-7 px-3 text-xs gap-1"
            onClick={handleApprove}
            disabled={!best || assignMutation.isPending}
          >
            {assignMutation.isPending
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <CheckCircle2 className="w-3 h-3" />}
            Approve
          </Button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="h-7 px-2 text-xs border rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Drivers
          </button>
        </div>
      </div>

      {/* Expanded driver list */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-1.5 bg-muted/10">
          {ranked.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No drivers available</p>
          ) : (
            ranked.slice(0, 5).map(c => (
              <DriverOption
                key={c.driver.id}
                candidate={c}
                selected={selected === c.driver.id}
                onClick={() => setSelected(c.driver.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function SmartDispatchPanel() {
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ['smart-dispatch-drivers'],
    queryFn: () => base44.entities.Driver.filter({ is_active: true }, 'name', 100),
    refetchInterval: 15000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['smart-dispatch-orders'],
    queryFn: () => base44.entities.Order.filter(
      { status: { $in: ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'] } },
      '-created_date', 200
    ),
    refetchInterval: 8000,
  });

  useEffect(() => {
    const u1 = base44.entities.Order.subscribe(() => queryClient.invalidateQueries({ queryKey: ['smart-dispatch-orders'] }));
    const u2 = base44.entities.Driver.subscribe(() => queryClient.invalidateQueries({ queryKey: ['smart-dispatch-drivers'] }));
    return () => { u1(); u2(); };
  }, []);

  const unassigned = orders.filter(o =>
    !o.driver_id && ['confirmed', 'preparing', 'pickup_ready'].includes(o.status) &&
    o.stripe_payment_status === 'paid' && o.id_verified_at_checkout === true && o.is_in_legal_zone === true
  );
  const activeOrders = orders.filter(o =>
    ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status)
  );
  const availableDrivers = drivers.filter(d => d.status === 'available');

  return (
    <div className="bg-card border rounded-2xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-secondary" />
          <h2 className="font-semibold">Smart Dispatch</h2>
          {unassigned.length > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5">
              {unassigned.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {availableDrivers.length} available
          </span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {drivers.length} total
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
        {unassigned.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">All orders are assigned</p>
          </div>
        ) : (
          unassigned.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              drivers={drivers}
              activeOrders={activeOrders}
            />
          ))
        )}
      </div>
    </div>
  );
}