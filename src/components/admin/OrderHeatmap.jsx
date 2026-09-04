import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const PINE_BLUFF_CENTER = [34.2284, -92.0032];

// Map order count → color (green → yellow → orange → red)
function heatColor(count, maxCount) {
  const t = Math.min(count / Math.max(maxCount, 1), 1);
  if (t < 0.33) return { color: '#16a34a', fill: '#22c55e' };   // green
  if (t < 0.66) return { color: '#d97706', fill: '#f59e0b' };   // amber
  return { color: '#dc2626', fill: '#ef4444' };                  // red
}

// Cluster orders by snapping lat/lng to a grid cell (~200m)
function clusterOrders(orders) {
  const GRID = 0.002; // ~200m
  const cells = {};
  orders.forEach(order => {
    const lat = order.order_latitude || order.delivery_latitude;
    const lng = order.order_longitude || order.delivery_longitude;
    if (!lat || !lng) return;
    const key = `${Math.round(lat / GRID) * GRID},${Math.round(lng / GRID) * GRID}`;
    if (!cells[key]) cells[key] = { lat: 0, lng: 0, count: 0, orders: [] };
    cells[key].lat += lat;
    cells[key].lng += lng;
    cells[key].count += 1;
    cells[key].orders.push(order);
  });
  return Object.values(cells).map(c => ({
    lat: c.lat / c.count,
    lng: c.lng / c.count,
    count: c.count,
    orders: c.orders,
  }));
}

function FitBounds({ clusters }) {
  const map = useMap();
  React.useEffect(() => {
    if (clusters.length < 2) return;
    const bounds = L.latLngBounds(clusters.map(c => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
  }, [clusters.length]);
  return null;
}

export default function OrderHeatmap({ orders, height = '480px' }) {
  const clusters = useMemo(() => clusterOrders(orders), [orders]);
  const maxCount = useMemo(() => Math.max(...clusters.map(c => c.count), 1), [clusters]);

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border relative">
      <MapContainer
        center={PINE_BLUFF_CENTER}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {clusters.length > 1 && <FitBounds clusters={clusters} />}

        {clusters.map((c, i) => {
          const { color, fill } = heatColor(c.count, maxCount);
          const radius = 10 + Math.sqrt(c.count) * 8; // scale circle size
          return (
            <CircleMarker
              key={i}
              center={[c.lat, c.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: fill, fillOpacity: 0.55, weight: 1.5 }}
            >
              <Popup>
                <div className="text-sm min-w-[140px]">
                  <p className="font-bold">{c.count} order{c.count !== 1 ? 's' : ''}</p>
                  <p className="text-muted-foreground text-xs">in this area</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {c.orders.slice(0, 5).map(o => (
                      <li key={o.id} className="text-muted-foreground">
                        {o.order_number} · ${o.total?.toFixed(2)}
                      </li>
                    ))}
                    {c.orders.length > 5 && <li className="text-muted-foreground">+{c.orders.length - 5} more</li>}
                  </ul>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 text-xs space-y-1.5 shadow">
        <p className="font-semibold mb-1">Demand Intensity</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Low</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> Medium</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> High</div>
      </div>

      {/* Order count badge */}
      <div className="absolute top-3 right-3 z-[1000] bg-background/95 border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow">
        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
        {orders.filter(o => o.order_latitude || o.delivery_latitude).length} plotted orders
      </div>
    </div>
  );
}