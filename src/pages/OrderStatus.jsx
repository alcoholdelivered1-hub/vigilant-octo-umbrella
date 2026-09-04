import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Package, Truck, CheckCircle2, Clock, MapPin, RefreshCw, Navigation } from 'lucide-react';
import CustomerOrderChat from '@/components/messaging/CustomerOrderChat';
import { formatDistanceToNow } from 'date-fns';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = new L.DivIcon({
  html: `<div style="background:#1d4ed8;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg width="16" height="16" fill="white" viewBox="0 0 24 24"><path d="M18 18.5a1.5 1.5 0 0 1-1.5 1.5 1.5 1.5 0 0 1-1.5-1.5 1.5 1.5 0 0 1 1.5-1.5 1.5 1.5 0 0 1 1.5 1.5m-11 0a1.5 1.5 0 0 1-1.5 1.5A1.5 1.5 0 0 1 4 18.5 1.5 1.5 0 0 1 5.5 17 1.5 1.5 0 0 1 7 18.5M17.5 8l1.96 5H5l1.5-5h11M12 2L2 7v13h20V7L12 2z"/></svg>
  </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const destIcon = new L.DivIcon({
  html: `<div style="background:#dc2626;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg width="14" height="14" fill="white" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const STATUS_CONFIG = {
  confirmed:     { label: 'Confirmed',       color: 'bg-blue-100 text-blue-700 border-blue-200',   icon: Clock,        step: 1 },
  preparing:     { label: 'Preparing',       color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Package,      step: 2 },
  pickup_ready:  { label: 'Pickup Ready',    color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Package,  step: 3 },
  in_transit:    { label: 'Out for Delivery',color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Truck,    step: 4 },
  delivered:     { label: 'Delivered',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, step: 5 },
};

const STEPS = [
  { key: 'confirmed',    label: 'Confirmed' },
  { key: 'preparing',   label: 'Preparing' },
  { key: 'pickup_ready',label: 'Pickup Ready' },
  { key: 'in_transit',  label: 'Out for Delivery' },
  { key: 'delivered',   label: 'Delivered' },
];

function StatusTimeline({ status }) {
  const currentStep = STATUS_CONFIG[status]?.step || 0;
  return (
    <div className="flex items-center gap-0 w-full mt-3">
      {STEPS.map((s, i) => {
        const cfg = STATUS_CONFIG[s.key];
        const done = cfg.step <= currentStep;
        const active = cfg.step === currentStep;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                done ? 'bg-primary border-primary' : 'bg-muted border-border'
              } ${active ? 'ring-2 ring-primary/30 ring-offset-1' : ''}`}>
                {done && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
              <p className={`text-[9px] mt-1 text-center leading-tight max-w-[52px] ${done ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                {s.label}
              </p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 transition-all ${done && cfg.step < currentStep ? 'bg-primary' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function OrderMap({ order }) {
  const hasDriver = order.driver_id && order.status === 'in_transit';
  const hasDelivery = order.delivery_latitude && order.delivery_longitude;
  if (!hasDelivery) return null;

  const center = [order.delivery_latitude, order.delivery_longitude];

  return (
    <div className="rounded-xl overflow-hidden border h-52 mt-3">
      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
        <Marker position={center} icon={destIcon}>
          <Popup><p className="text-xs font-medium">{order.delivery_address}</p></Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

function OrderCard({ order }) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed;
  const Icon = cfg.icon;
  const isActive = !['delivered', 'cancelled', 'refused'].includes(order.status);

  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-3 ${isActive ? 'shadow-sm ring-1 ring-primary/10' : 'opacity-80'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{order.order_number}</p>
          <p className="text-xs text-muted-foreground">{order.store_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(order.created_date), { addSuffix: true })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
          <p className="text-sm font-bold">${order.total?.toFixed(2)}</p>
        </div>
      </div>

      {/* Driver info (in_transit) */}
      {order.status === 'in_transit' && order.driver_name && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
          <Truck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-indigo-800">Driver: {order.driver_name}</p>
            <p className="text-xs text-indigo-600">On the way to your location</p>
          </div>
        </div>
      )}

      {/* Delivery address */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{order.delivery_address}</span>
      </div>

      {/* Timeline */}
      {isActive && <StatusTimeline status={order.status} />}

      {/* Map */}
      {order.status === 'in_transit' && <OrderMap order={order} />}

      {/* Directions button */}
      {order.status === 'in_transit' && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors"
        >
          <Navigation className="w-4 h-4" /> Open in Google Maps
        </a>
      )}

      {/* Customer ↔ Driver chat (active orders only) */}
      {isActive && order.driver_id && (
        <CustomerOrderChat
          orderId={order.id}
          orderNumber={order.order_number}
          customerName={order.customer_name}
        />
      )}
    </div>
  );
}

export default function OrderStatus() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['order-status-dashboard'],
    queryFn: () => base44.entities.Order.filter(
      { status: { $in: ['confirmed', 'preparing', 'pickup_ready', 'in_transit', 'delivered'] } },
      '-updated_date',
      100
    ),
    refetchInterval: 15000,
    onSuccess: () => setLastRefresh(new Date()),
  });

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.Order.subscribe(() => {
      refetch();
      setLastRefresh(new Date());
    });
    return unsub;
  }, []);

  const active = orders.filter(o => ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status));
  const delivered = orders.filter(o => o.status === 'delivered');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Order Status</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live updates · Last refreshed {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={() => { refetch(); setLastRefresh(new Date()); }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
          Loading orders...
        </div>
      ) : (
        <>
          {/* Active Orders */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="font-semibold text-sm">Active Orders <span className="text-muted-foreground font-normal">({active.length})</span></h2>
            </div>
            {active.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border">
                <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active orders right now</p>
              </div>
            ) : (
              active.map(order => <OrderCard key={order.id} order={order} />)
            )}
          </section>

          {/* Delivered Today */}
          {delivered.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-semibold text-sm text-muted-foreground">
                Recently Delivered <span className="font-normal">({delivered.length})</span>
              </h2>
              {delivered.slice(0, 5).map(order => <OrderCard key={order.id} order={order} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}