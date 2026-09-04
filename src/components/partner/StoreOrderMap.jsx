import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/lib/utils';
import { Clock, Truck, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLORS = {
  pending:      '#94a3b8',
  confirmed:    '#3b82f6',
  preparing:    '#f59e0b',
  pickup_ready: '#8b5cf6',
  in_transit:   '#10b981',
  delivered:    '#6b7280',
};

const STATUS_LABELS = {
  pending:      'Pending',
  confirmed:    'Confirmed',
  preparing:    'Preparing',
  pickup_ready: 'Ready for Pickup',
  in_transit:   'In Transit',
  delivered:    'Delivered',
};

function makeOrderIcon(status, orderNum) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  const short = (orderNum || '?').toString().slice(-3);
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        color:white;
        border-radius:50%;
        width:34px;height:34px;
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:700;
        border:2px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        cursor:pointer;
      ">#${short}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function makeDriverIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#1e3a8a;
      color:white;
      border-radius:50%;
      width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      font-size:14px;
    ">🚗</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function makeStoreIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#1e3a8a;
      color:white;
      border-radius:8px;
      width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      font-size:16px;
    ">🏪</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function AutoFitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [50, 50], maxZoom: 14 });
    }
  }, [JSON.stringify(positions)]);
  return null;
}

export default function StoreOrderMap({ orders = [], store, selectedOrderId, onSelectOrder }) {
  // Build all plottable positions
  const orderPoints = useMemo(() =>
    orders.filter(o => o.delivery_latitude && o.delivery_longitude),
    [orders]
  );

  const allPositions = useMemo(() => {
    const pts = orderPoints.map(o => [o.delivery_latitude, o.delivery_longitude]);
    if (store?.latitude && store?.longitude) pts.unshift([store.latitude, store.longitude]);
    return pts;
  }, [orderPoints, store]);

  const defaultCenter = store?.latitude
    ? [store.latitude, store.longitude]
    : [34.7465, -92.2896]; // Little Rock, AR fallback

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AutoFitBounds positions={allPositions} />

        {/* Store marker */}
        {store?.latitude && store?.longitude && (
          <Marker position={[store.latitude, store.longitude]} icon={makeStoreIcon()}>
            <Popup>
              <div className="text-sm font-semibold">{store.name}</div>
              <div className="text-xs text-gray-500">{store.address}</div>
            </Popup>
          </Marker>
        )}

        {/* Order markers */}
        {orderPoints.map(order => {
          const isSelected = selectedOrderId === order.id;
          const pos = [order.delivery_latitude, order.delivery_longitude];
          return (
            <React.Fragment key={order.id}>
              <Marker
                position={pos}
                icon={makeOrderIcon(order.status, order.order_number)}
                eventHandlers={{ click: () => onSelectOrder(order.id === selectedOrderId ? null : order.id) }}
              >
                <Popup>
                  <div className="text-xs space-y-1 min-w-[160px]">
                    <p className="font-bold text-sm">#{order.order_number}</p>
                    <p>{order.customer_name}</p>
                    <p className="text-gray-500">{order.delivery_address}</p>
                    <p>
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-white text-xs font-medium"
                        style={{ background: STATUS_COLORS[order.status] }}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </p>
                    {order.driver_name && <p className="text-blue-600 font-medium">🚗 {order.driver_name}</p>}
                  </div>
                </Popup>
              </Marker>

              {/* Driver live location line */}
              {order.status === 'in_transit' && order.driver_current_latitude && order.driver_current_longitude && (
                <>
                  <Marker
                    position={[order.driver_current_latitude, order.driver_current_longitude]}
                    icon={makeDriverIcon()}
                  >
                    <Popup>
                      <div className="text-xs">
                        <p className="font-bold">{order.driver_name}</p>
                        <p className="text-gray-500">En route to #{order.order_number}</p>
                      </div>
                    </Popup>
                  </Marker>
                  <Polyline
                    positions={[
                      [order.driver_current_latitude, order.driver_current_longitude],
                      pos,
                    ]}
                    pathOptions={{ color: STATUS_COLORS.in_transit, weight: 2, dashArray: '6 4', opacity: 0.7 }}
                  />
                </>
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur rounded-xl border shadow-md px-3 py-2.5 space-y-1.5">
        {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'delivered').map(([status, label]) => (
          <div key={status} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[status] }} />
            <span className="text-slate-700">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs border-t pt-1.5 mt-1">
          <span className="text-sm">🏪</span><span className="text-slate-700">Your Store</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-sm">🚗</span><span className="text-slate-700">Driver (live)</span>
        </div>
      </div>

      {/* No GPS data notice */}
      {orderPoints.length === 0 && orders.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
          <div className="bg-white/90 rounded-xl border shadow px-4 py-3 text-center text-sm text-muted-foreground">
            <MapPin className="w-5 h-5 mx-auto mb-1 opacity-40" />
            Active orders don't have GPS coordinates yet.
          </div>
        </div>
      )}
    </div>
  );
}