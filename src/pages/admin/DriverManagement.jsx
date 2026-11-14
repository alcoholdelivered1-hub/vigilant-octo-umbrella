import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Truck, User, Package, Circle, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const STATUS_COLOR = {
  available: 'text-emerald-500',
  on_delivery: 'text-blue-500',
  offline: 'text-muted-foreground',
  suspended: 'text-destructive',
};

const STATUS_LABEL = {
  available: 'Available',
  on_delivery: 'On Delivery',
  offline: 'Offline',
  suspended: 'Suspended',
};

const ORDER_STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  pickup_ready: 'Pickup Ready',
  in_transit: 'Out for Delivery',
};

function DriverCard({ driver, orders, onAssign, onToggleShift }) {
  const [expanded, setExpanded] = useState(false);
  const driverOrders = orders.filter(o => o.driver_id === driver.id && !['delivered', 'cancelled', 'refused'].includes(o.status));
  const isActive = driver.status !== 'offline' && driver.status !== 'suspended';

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-all ${isActive ? 'shadow-sm' : 'opacity-70'}`}>
      {/* Driver Header */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-primary/10' : 'bg-muted'}`}>
            <User className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="font-semibold text-sm">{driver.name}</p>
            <p className="text-xs text-muted-foreground">{driver.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Shift Toggle */}
          <button
            onClick={() => onToggleShift(driver)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            }`}
          >
            {isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {isActive ? 'Active' : 'Inactive'}
          </button>
          {/* Expand */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 pb-3 flex items-center gap-4 text-xs">
        <span className={`flex items-center gap-1.5 font-medium ${STATUS_COLOR[driver.status] || 'text-muted-foreground'}`}>
          <Circle className="w-2 h-2 fill-current" />
          {STATUS_LABEL[driver.status] || driver.status}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Package className="w-3.5 h-3.5" />
          {driverOrders.length} active {driverOrders.length === 1 ? 'order' : 'orders'}
        </span>
        <span className="text-muted-foreground">{driver.total_deliveries || 0} total deliveries</span>
      </div>

      {/* Expanded: Active Orders + Assign */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
          {driverOrders.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Orders</p>
              {driverOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between bg-card border rounded-xl px-3 py-2 text-xs">
                  <div>
                    <p className="font-semibold">{order.order_number}</p>
                    <p className="text-muted-foreground truncate max-w-[160px]">{order.delivery_address}</p>
                  </div>
                  <span className="font-medium text-primary">{ORDER_STATUS_LABEL[order.status] || order.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No active orders assigned</p>
          )}

          {/* Assign Order */}
          <AssignOrderPanel driver={driver} orders={orders} onAssign={onAssign} />
        </div>
      )}
    </div>
  );
}

function AssignOrderPanel({ driver, orders, onAssign }) {
  const [selectedOrder, setSelectedOrder] = useState('');
  const unassigned = orders.filter(o =>
    ['pending', 'confirmed', 'preparing', 'pickup_ready'].includes(o.status) && !o.driver_id
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assign Order</p>
      {unassigned.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No unassigned orders available</p>
      ) : (
        <div className="flex gap-2">
          <Select value={selectedOrder} onValueChange={setSelectedOrder}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Select an order..." />
            </SelectTrigger>
            <SelectContent>
              {unassigned.map(o => (
                <SelectItem key={o.id} value={o.id} className="text-xs">
                  {o.order_number} — {o.customer_name} — ${o.total?.toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs px-3"
            disabled={!selectedOrder}
            onClick={() => { onAssign(selectedOrder, driver); setSelectedOrder(''); }}
          >
            Assign
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DriverManagement() {
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['drivers-mgmt'],
    queryFn: () => base44.entities.Driver.filter({ is_active: true }, 'name', 100),
    refetchInterval: 20000,
  });

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['orders-mgmt'],
    queryFn: () => base44.entities.Order.filter(
      { status: { $in: ['pending', 'confirmed', 'preparing', 'pickup_ready', 'in_transit'] } },
      '-created_date', 100
    ),
    refetchInterval: 15000,
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, driver }) =>
      base44.entities.Order.update(orderId, {
        driver_id: driver.id,
        driver_name: driver.name,
        status: 'confirmed',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders-mgmt'] });
      toast.success('Order assigned successfully!');
    },
    onError: () => toast.error('Failed to assign order.'),
  });

  const shiftMutation = useMutation({
    mutationFn: ({ driver }) => {
      const newStatus = driver.status === 'offline' ? 'available' : 'offline';
      return base44.entities.Driver.update(driver.id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers-mgmt'] });
      toast.success('Driver shift status updated.');
    },
    onError: () => toast.error('Failed to update shift status.'),
  });

  const handleAssign = (orderId, driver) => assignMutation.mutate({ orderId, driver });
  const handleToggleShift = (driver) => shiftMutation.mutate({ driver });

  // Summary stats
  const activeDrivers = drivers.filter(d => d.status !== 'offline' && d.status !== 'suspended');
  const onDelivery = drivers.filter(d => d.status === 'on_delivery');
  const unassignedOrders = orders.filter(o => !o.driver_id && ['pending', 'confirmed'].includes(o.status));

  const isLoading = loadingDrivers || loadingOrders;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold">Driver Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Assign orders, manage shifts, track delivery load</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Drivers', value: activeDrivers.length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'On Delivery', value: onDelivery.length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Unassigned Orders', value: unassignedOrders.length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-3 text-center ${stat.bg}`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Unassigned Orders Alert */}
      {unassignedOrders.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span><strong>{unassignedOrders.length}</strong> order{unassignedOrders.length > 1 ? 's' : ''} waiting to be assigned to a driver.</span>
        </div>
      )}

      {/* Driver List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : drivers.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <Truck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No active drivers found</p>
          <p className="text-xs text-muted-foreground mt-1">Add drivers in the Admin Drivers section</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active first */}
          {[...drivers]
            .sort((a, b) => {
              const order = { available: 0, on_delivery: 1, offline: 2, suspended: 3 };
              return (order[a.status] ?? 4) - (order[b.status] ?? 4);
            })
            .map(driver => (
              <DriverCard
                key={driver.id}
                driver={driver}
                orders={orders}
                onAssign={handleAssign}
                onToggleShift={handleToggleShift}
              />
            ))}
        </div>
      )}
    </div>
  );
}