import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, Navigation, Package, MapPin, Loader2, Route, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const PINE_BLUFF = [34.2284, -92.0032];

// Custom colored marker icons
function makeIcon(color, label) {
  return L.divIcon({
    html: `<div style="
      background:${color};
      color:white;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      width:34px;height:34px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      font-weight:700;font-size:12px;
    "><span style="transform:rotate(45deg)">${label}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -36],
    className: '',
  });
}

const DRIVER_ICON = L.divIcon({
  html: `<div style="
    background:#1e3a5f;color:white;border-radius:50%;
    width:38px;height:38px;display:flex;align-items:center;justify-content:center;
    border:3px solid #f59e0b;box-shadow:0 2px 10px rgba(0,0,0,0.4);font-size:18px;
  ">🚗</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  className: '',
});

const STATUS_COLOR = {
  confirmed: '#6366f1',
  preparing: '#f59e0b',
  pickup_ready: '#22c55e',
  in_transit: '#3b82f6',
};

// Geocode an address using Nominatim (free, no API key needed)
async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Arkansas, USA')}&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'AlcoholDelivered/1.0' } });
  const data = await res.json();
  if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  return null;
}

// Nearest-neighbor route optimization starting from driver's position
function optimizeRoute(driverPos, orders) {
  const remaining = [...orders];
  const route = [];
  let current = driverPos || PINE_BLUFF;

  while (remaining.length > 0) {
    let nearest = null;
    let nearestDist = Infinity;
    let nearestIdx = 0;
    remaining.forEach((o, i) => {
      if (!o._coords) return;
      const dist = Math.hypot(o._coords[0] - current[0], o._coords[1] - current[1]);
      if (dist < nearestDist) { nearestDist = dist; nearest = o; nearestIdx = i; }
    });
    if (!nearest) break;
    route.push(nearest);
    current = nearest._coords;
    remaining.splice(nearestIdx, 1);
  }
  // Append orders without coords at the end
  orders.filter(o => !o._coords).forEach(o => route.push(o));
  return route;
}

// Auto-fit map bounds
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [points.length]);
  return null;
}

function OrderCard({ order, index, onEnRoute, isUpdating }) {
  const statusColor = STATUS_COLOR[order.status] || '#94a3b8';
  return (
    <div className={`bg-card border-l-4 rounded-xl p-4 space-y-3 shadow-sm`}
      style={{ borderLeftColor: statusColor }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
            style={{ background: statusColor }}>
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-sm">{order.order_number}</p>
            <p className="text-xs text-muted-foreground">{order.store_name}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs capitalize" style={{ color: statusColor, borderColor: statusColor }}>
          {order.status?.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{order.delivery_address}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Package className="w-3.5 h-3.5" />
        <span>{order.items?.length || 0} items · {order.customer_name} · ${order.total?.toFixed(2)}</span>
      </div>

      <div className="flex gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving`}
          target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" /> Navigate
        </a>

        {order.status === 'pickup_ready' && (
          <Button size="sm" className="flex-1 text-xs h-8 bg-amber-500 hover:bg-amber-600" onClick={() => onEnRoute(order)} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5 mr-1" />}
            En Route
          </Button>
        )}

        {order.status === 'in_transit' && (
          <div className="flex-1 text-center text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-2">
            Verify ID in My Deliveries
          </div>
        )}
      </div>
    </div>
  );
}

export default function DriverDeliveryMap({ orders: rawOrders = [], userEmail }) {
  const queryClient = useQueryClient();
  const [driverPos, setDriverPos] = useState(null);
  const [geocoded, setGeocoded] = useState([]);
  const [geocoding, setGeocoding] = useState(false);
  const [routePoints, setRoutePoints] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);
  const geocodeCache = useRef({});

  // Today's active orders only
  const today = format(new Date(), 'yyyy-MM-dd');
  const activeOrders = rawOrders.filter(o =>
    ['confirmed', 'preparing', 'pickup_ready', 'in_transit'].includes(o.status) &&
    o.created_date?.startsWith(today)
  );

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      pos => setDriverPos([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Geocode delivery addresses
  const runGeocode = useCallback(async (orders) => {
    setGeocoding(true);
    const results = await Promise.all(orders.map(async o => {
      if (o.delivery_latitude && o.delivery_longitude) {
        return { ...o, _coords: [o.delivery_latitude, o.delivery_longitude] };
      }
      const cacheKey = o.delivery_address;
      if (geocodeCache.current[cacheKey]) {
        return { ...o, _coords: geocodeCache.current[cacheKey] };
      }
      const coords = await geocode(o.delivery_address);
      if (coords) geocodeCache.current[cacheKey] = coords;
      return { ...o, _coords: coords };
    }));
    const optimized = optimizeRoute(driverPos, results);
    setGeocoded(optimized);
    // Build polyline: driver → stop 1 → stop 2 → ...
    const pts = [];
    if (driverPos) pts.push(driverPos);
    optimized.forEach(o => { if (o._coords) pts.push(o._coords); });
    setRoutePoints(pts);
    setGeocoding(false);
  }, [driverPos]);

  useEffect(() => {
    if (activeOrders.length > 0) runGeocode(activeOrders);
    else { setGeocoded([]); setRoutePoints([]); }
  }, [activeOrders.length, rawOrders]);

  const updateMutation = useMutation({
    mutationFn: ({ id, action }) => base44.functions.invoke('updateDriverOrderStatus', { order_id: id, action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-orders'] });
      setUpdatingId(null);
    },
    onError: () => setUpdatingId(null),
  });

  const handleEnRoute = async (order) => {
    setUpdatingId(order.id);
    updateMutation.mutate({ id: order.id, action: 'pickup' });
    toast.success(`En route to ${order.customer_name}!`);
  };

  const allPoints = [
    ...(driverPos ? [driverPos] : []),
    ...geocoded.filter(o => o._coords).map(o => o._coords),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Today's Route</h2>
            <p className="text-xs text-muted-foreground">{activeOrders.length} active stops · optimized order</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {geocoding && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Routing…</span>}
          {driverPos && <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">● GPS Live</span>}
          <Button variant="outline" size="sm" onClick={() => runGeocode(activeOrders)} disabled={geocoding}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-2xl">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No active deliveries today</p>
          <p className="text-xs text-muted-foreground mt-1">New orders will appear here automatically</p>
        </div>
      ) : (
        <>
          {/* Map */}
          <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ height: 380 }}>
            <MapContainer
              center={driverPos || PINE_BLUFF}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              {allPoints.length > 0 && <FitBounds points={allPoints} />}

              {/* Optimized route polyline */}
              {routePoints.length > 1 && (
                <Polyline
                  positions={routePoints}
                  pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '8,6', opacity: 0.8 }}
                />
              )}

              {/* Driver position */}
              {driverPos && (
                <Marker position={driverPos} icon={DRIVER_ICON}>
                  <Popup><span className="font-semibold text-sm">📍 You</span></Popup>
                </Marker>
              )}

              {/* Delivery stop markers */}
              {geocoded.map((order, i) => {
                if (!order._coords) return null;
                const color = STATUS_COLOR[order.status] || '#94a3b8';
                const icon = makeIcon(color, i + 1);
                return (
                  <Marker key={order.id} position={order._coords} icon={icon}>
                    <Popup minWidth={220} maxWidth={280}>
                      <div className="space-y-2 py-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm">Stop {i + 1} · {order.order_number}</span>
                          <span className="text-xs capitalize px-2 py-0.5 rounded-full text-white font-medium"
                            style={{ background: color }}>
                            {order.status?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{order.customer_name}</p>
                        <p className="text-xs text-gray-500">{order.delivery_address}</p>
                        <p className="text-xs text-gray-500">{order.items?.length || 0} items · ${order.total?.toFixed(2)}</p>
                        <div className="flex gap-1.5 pt-1">
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}&travelmode=driving`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-center bg-blue-600 text-white text-xs py-1.5 rounded font-medium">
                            Navigate
                          </a>
                          {order.status === 'pickup_ready' && (
                            <button onClick={() => handleEnRoute(order)}
                              className="flex-1 bg-amber-500 text-white text-xs py-1.5 rounded font-medium">
                              En Route
                            </button>
                          )}
                          {order.status === 'in_transit' && (
                            <span className="flex-1 text-center bg-amber-100 text-amber-800 text-xs py-1.5 rounded font-medium">
                              Verify ID in My Deliveries
                            </span>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {Object.entries(STATUS_COLOR).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                {status.replace('_', ' ')}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="text-base leading-none">🚗</span> You
            </span>
          </div>

          {/* Ordered stop list */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Optimized Stop Order</p>
            {geocoded.map((order, i) => (
              <OrderCard
                key={order.id}
                order={order}
                index={i}
                onEnRoute={handleEnRoute}
                isUpdating={updatingId === order.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}