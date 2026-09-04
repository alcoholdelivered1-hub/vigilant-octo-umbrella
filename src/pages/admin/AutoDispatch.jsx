import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateDistance } from '@/lib/distanceUtils';
import {
  Zap, Truck, Package, MapPin, Clock, RefreshCw, CheckCircle2,
  AlertTriangle, User, Loader2, Radio, BotMessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// Pine Bluff, AR center coords (fallback for orders without GPS)
const PINE_BLUFF_LAT = 34.2284;
const PINE_BLUFF_LON = -92.0032;

const STATUS_COLOR = {
  available: 'text-emerald-500',
  on_delivery: 'text-blue-500',
  offline: 'text-muted-foreground',
  suspended: 'text-destructive',
};

const CAPACITY_LIMIT = { car: 3, suv: 4, truck: 5, van: 6, motorcycle: 2 };

function getCapacity(driver) {
  const info = (driver.vehicle_info || '').toLowerCase();
  for (const [type, limit] of Object.entries(CAPACITY_LIMIT)) {
    if (info.includes(type)) return limit;
  }
  return 3;
}

function scoreDriver(driver, order, driverOrders) {
  const lat = order.delivery_latitude || order.order_latitude || PINE_BLUFF_LAT;
  const lon = order.delivery_longitude || order.order_longitude || PINE_BLUFF_LON;
  const dLat = driver.current_latitude || PINE_BLUFF_LAT;
  const dLon = driver.current_longitude || PINE_BLUFF_LON;

  const distance = calculateDistance(dLat, dLon, lat, lon);
  const load = driverOrders.filter(o => o.driver_id === driver.id).length;
  const capacity = getCapacity(driver);
  // Score: lower is better — distance (miles) + 4 per active order already carrying
  return { distance: parseFloat(distance.toFixed(1)), load, capacity, score: distance + load * 4 };
}

function rankDrivers(drivers, order, activeOrders) {
  return drivers
    .filter(d => d.status === 'available' || d.status === 'on_delivery')
    .map(d => ({ driver: d, ...scoreDriver(d, order, activeOrders) }))
    .filter(d => d.load < d.capacity) // respect capacity
    .sort((a, b) => a.score - b.score);
}

function DriverTag({ driver, distance, load, capacity, score, selected, onClick, assigning }) {
  const isAvailable = driver.status === 'available';
  return (
    <button
      onClick={onClick}
      disabled={assigning}
      className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border hover:border-primary/40 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isAvailable ? 'bg-emerald-500' : 'bg-blue-400'}`} />
        <div>
          <p className="text-sm font-medium leading-none">{driver.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{load} active order{load !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-primary">{distance} mi away</p>
        <p className="text-[10px] text-muted-foreground">{load}/{capacity} capacity · score {score.toFixed(1)}</p>
      </div>
    </button>
  );
}

function OrderDispatchCard({ order, drivers, activeOrders, onAssign, assigning }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const ranked = rankDrivers(drivers, order, activeOrders);
  const best = ranked[0];

  const age = order.created_date
    ? formatDistanceToNow(new Date(order.created_date), { addSuffix: true })
    : '—';

  const handleAutoAssign = () => {
    if (!best) { toast.error('No available drivers nearby'); return; }
    onAssign(order, best.driver, true);
  };

  const handleManualAssign = () => {
    if (!selectedDriver) { toast.error('Please select a driver'); return; }
    const found = drivers.find(d => d.id === selectedDriver);
    if (found) onAssign(order, found, false);
  };

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <Package className="w-4 h-4 text-amber-700" />
          </div>
          <div>
            <p className="font-semibold text-sm">{order.order_number}</p>
            <p className="text-xs text-muted-foreground">{order.store_name} · {age}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize bg-amber-50 border-amber-200 text-amber-800">
            {order.status.replace(/_/g, ' ')}
          </Badge>
          <span className="font-bold text-sm">${order.total?.toFixed(2)}</span>
        </div>
      </div>

      {/* Delivery address */}
      <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground border-b">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{order.delivery_address}</span>
        <span className="ml-auto text-foreground font-medium">{order.customer_name}</span>
      </div>

      {/* Auto-assign strip */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {best ? (
          <div className="flex items-center gap-2 text-xs">
            <Zap className="w-3.5 h-3.5 text-secondary" />
            <span>Best match: <strong>{best.driver.name}</strong> ({best.distance} mi, {best.load} orders)</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" /> No available drivers
          </div>
        )}
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs px-3 gap-1"
            onClick={handleAutoAssign}
            disabled={!best || assigning}
          >
            {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Auto Assign
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3"
            onClick={() => setExpanded(e => !e)}
          >
            Manual
          </Button>
        </div>
      </div>

      {/* Manual assignment panel */}
      {expanded && (
        <div className="border-t px-4 py-3 bg-muted/10 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ranked Drivers (nearest first)</p>
          {ranked.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active drivers available</p>
          ) : (
            ranked.slice(0, 5).map(({ driver, distance, load, capacity, score }) => (
            <DriverTag
              key={driver.id}
              driver={driver}
              distance={distance}
              load={load}
              capacity={capacity}
              score={score}
                selected={selectedDriver === driver.id}
                onClick={() => setSelectedDriver(driver.id)}
                assigning={assigning}
              />
            ))
          )}
          {selectedDriver && (
            <Button size="sm" className="w-full mt-1 h-8 text-xs" onClick={handleManualAssign} disabled={assigning}>
              {assigning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
              Assign to {drivers.find(d => d.id === selectedDriver)?.name}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DriverStatusCard({ driver, activeOrders }) {
  const orders = activeOrders.filter(o => o.driver_id === driver.id);
  return (
    <div className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${driver.status === 'offline' ? 'opacity-60' : ''}`}>
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${STATUS_COLOR[driver.status]?.replace('text-', 'bg-') || 'bg-muted'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{driver.name}</p>
        <p className={`text-xs font-medium capitalize ${STATUS_COLOR[driver.status]}`}>
          {driver.status?.replace(/_/g, ' ')}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold">{orders.length}</p>
        <p className="text-[10px] text-muted-foreground">orders</p>
      </div>
    </div>
  );
}

export default function AutoDispatch() {
  const queryClient = useQueryClient();
  const [autoMode, setAutoMode] = useState(false);
  const [lastAutoRun, setLastAutoRun] = useState(null);
  const [dispatchLog, setDispatchLog] = useState([]);

  const { data: drivers = [] } = useQuery({
    queryKey: ['dispatch-drivers'],
    queryFn: () => base44.entities.Driver.filter({ is_active: true }, 'name', 100),
    refetchInterval: 15000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['dispatch-orders'],
    queryFn: () => base44.entities.Order.filter(
      { status: { $in: ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'] } },
      '-created_date', 200
    ),
    refetchInterval: 8000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ order, driver }) =>
      base44.entities.Order.update(order.id, {
        driver_id: driver.id,
        driver_name: driver.name,
        status: order.status === 'pending' ? 'confirmed' : order.status,
      }),
    onSuccess: (_, { order, driver, auto }) => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-drivers'] });
      const entry = {
        id: Date.now(),
        time: new Date(),
        order: order.order_number,
        driver: driver.name,
        auto,
      };
      setDispatchLog(prev => [entry, ...prev].slice(0, 20));
      toast.success(`${order.order_number} → ${driver.name}${auto ? ' (auto)' : ''}`);
    },
    onError: () => toast.error('Dispatch failed'),
  });

  const handleAssign = useCallback((order, driver, auto = false) => {
    assignMutation.mutate({ order, driver, auto });
  }, [assignMutation]);

  // Unassigned orders (no driver yet, active status)
  const unassigned = orders.filter(o =>
    !o.driver_id && ['pending', 'confirmed', 'preparing', 'pickup_ready'].includes(o.status)
  );
  const activeOrders = orders.filter(o =>
    ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status)
  );
  const availableDrivers = drivers.filter(d => d.status === 'available');

  // Auto-dispatch loop
  useEffect(() => {
    if (!autoMode) return;
    const interval = setInterval(() => {
      const pending = orders.filter(o =>
        !o.driver_id && ['pending', 'confirmed'].includes(o.status)
      );
      if (pending.length === 0) return;
      const currentActiveOrders = orders.filter(o =>
        ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status)
      );
      pending.forEach(order => {
        const ranked = rankDrivers(drivers, order, currentActiveOrders);
        if (ranked[0]) {
          handleAssign(order, ranked[0].driver, true);
        }
      });
      setLastAutoRun(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, [autoMode, orders, drivers, handleAssign]);

  // Real-time subscriptions
  useEffect(() => {
    const u1 = base44.entities.Order.subscribe(() => queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] }));
    const u2 = base44.entities.Driver.subscribe(() => queryClient.invalidateQueries({ queryKey: ['dispatch-drivers'] }));
    return () => { u1(); u2(); };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Zap className="w-7 h-7 text-secondary" />
            Auto Dispatch
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">Assign orders to nearest available drivers by GPS &amp; load</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card border rounded-xl px-4 py-2">
            <div className={`w-2 h-2 rounded-full ${autoMode ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-sm font-medium">{autoMode ? 'Auto-dispatch ON' : 'Auto-dispatch OFF'}</span>
            <button
              onClick={() => setAutoMode(m => !m)}
              className={`ml-1 w-10 h-5 rounded-full transition-colors relative ${autoMode ? 'bg-emerald-500' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${autoMode ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] });
              queryClient.invalidateQueries({ queryKey: ['dispatch-drivers'] });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Unassigned Orders', value: unassigned.length, color: unassigned.length > 0 ? 'text-amber-600' : 'text-foreground', bg: unassigned.length > 0 ? 'bg-amber-50 border-amber-200' : '' },
          { label: 'Available Drivers', value: availableDrivers.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'Active Orders', value: activeOrders.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Total Drivers', value: drivers.length, color: 'text-foreground', bg: '' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center bg-card ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Always-on automation banner */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <BotMessageSquare className="w-4 h-4 flex-shrink-0" />
        <span><strong>Server automation active:</strong> Every new <em>pending</em> order is automatically dispatched to the nearest available driver (respecting vehicle capacity) in real time — even when this page is closed.</span>
      </div>

      {autoMode && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
          <Radio className="w-4 h-4 animate-pulse" />
          <span><strong>In-page auto-dispatch is also ON.</strong> Unassigned orders are re-checked every 10 seconds.{lastAutoRun ? ` Last run: ${formatDistanceToNow(lastAutoRun, { addSuffix: true })}` : ''}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Unassigned orders */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              Unassigned Orders
              {unassigned.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{unassigned.length}</span>
              )}
            </h2>
            {unassigned.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  const current = orders.filter(o =>
                    ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status)
                  );
                  let count = 0;
                  unassigned.forEach(order => {
                    const ranked = rankDrivers(drivers, order, current);
                    if (ranked[0]) { handleAssign(order, ranked[0].driver, true); count++; }
                  });
                  if (count === 0) toast.error('No available drivers to dispatch');
                  else toast.success(`Dispatched ${count} order${count !== 1 ? 's' : ''}`);
                }}
                disabled={assignMutation.isPending}
              >
                <Zap className="w-3 h-3" /> Assign All
              </Button>
            )}
          </div>

          {unassigned.length === 0 ? (
            <div className="bg-card border rounded-2xl py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <p className="font-medium text-muted-foreground">All orders are assigned!</p>
            </div>
          ) : (
            unassigned.map(order => (
              <OrderDispatchCard
                key={order.id}
                order={order}
                drivers={drivers}
                activeOrders={activeOrders}
                onAssign={handleAssign}
                assigning={assignMutation.isPending}
              />
            ))
          )}

          {/* Assigned active orders */}
          {activeOrders.filter(o => o.driver_id).length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Assigned &amp; Active ({activeOrders.filter(o => o.driver_id).length})
              </h2>
              <div className="space-y-2">
                {activeOrders.filter(o => o.driver_id).map(order => (
                  <div key={order.id} className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{order.delivery_address}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{order.status.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Truck className="w-3 h-3" /> {order.driver_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Driver fleet + dispatch log */}
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4" /> Driver Fleet
            </h2>
            <div className="space-y-2">
              {drivers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No active drivers</p>
              ) : (
                [...drivers]
                  .sort((a, b) => {
                    const order = { available: 0, on_delivery: 1, offline: 2, suspended: 3 };
                    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                  })
                  .map(driver => (
                    <DriverStatusCard key={driver.id} driver={driver} activeOrders={activeOrders} />
                  ))
              )}
            </div>
          </div>

          {/* Dispatch Log */}
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Dispatch Log
            </h2>
            {dispatchLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 bg-card border rounded-xl">No dispatches yet this session</p>
            ) : (
              <div className="bg-card border rounded-xl divide-y max-h-72 overflow-y-auto">
                {dispatchLog.map(entry => (
                  <div key={entry.id} className="px-3 py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.auto ? 'bg-secondary' : 'bg-primary'}`} />
                      <span className="font-medium">{entry.order}</span>
                      <span className="text-muted-foreground">→ {entry.driver}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground flex-shrink-0">
                      {entry.auto && <span className="text-[9px] bg-secondary/10 text-secondary font-semibold px-1 py-0.5 rounded">AUTO</span>}
                      <span>{formatDistanceToNow(entry.time, { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}