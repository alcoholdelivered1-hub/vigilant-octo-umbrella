import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const JEFFERSON_CENTER = [34.2284, -92.0032];

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 13 });
    } else {
      map.setView(JEFFERSON_CENTER, 10);
    }
  }, [points.length]);
  return null;
}

function CountyOverlay() {
  const map = useMap();
  useEffect(() => {
    const rect = L.rectangle(
      [[34.0, -92.23], [34.495, -91.75]],
      { color: '#1e3a5f', weight: 2, dashArray: '8 5', fillColor: '#1e3a5f', fillOpacity: 0.04 }
    ).addTo(map);
    rect.bindTooltip('Jefferson County Service Area', { direction: 'top' });
    return () => rect.remove();
  }, []);
  return null;
}

function makeStoreIcon(tier) {
  const fill = tier === 'premium' ? '#7c3aed' : tier === 'featured' ? '#d97706' : '#1e3a5f';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">
    <ellipse cx="15" cy="33" rx="7" ry="2.5" fill="rgba(0,0,0,0.18)"/>
    <path d="M15 0C6.72 0 0 6.72 0 15c0 11.25 15 21 15 21S30 26.25 30 15C30 6.72 23.28 0 15 0z" fill="${fill}"/>
    <circle cx="15" cy="14" r="8.5" fill="white" opacity="0.95"/>
    <text x="15" y="18.5" text-anchor="middle" font-family="sans-serif" font-size="12">🏪</text>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [30, 36], iconAnchor: [15, 36], popupAnchor: [0, -36], className: '' });
}

function makeOrderIcon(status) {
  const colors = {
    pending:      { bg: '#f59e0b', emoji: '⏳' },
    confirmed:    { bg: '#3b82f6', emoji: '✅' },
    preparing:    { bg: '#8b5cf6', emoji: '🍶' },
    pickup_ready: { bg: '#f97316', emoji: '📦' },
    in_transit:   { bg: '#10b981', emoji: '🚗' },
  };
  const { bg, emoji } = colors[status] || { bg: '#6b7280', emoji: '•' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="30" viewBox="0 0 26 30">
    <ellipse cx="13" cy="28" rx="6" ry="2" fill="rgba(0,0,0,0.18)"/>
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 17 13 17S26 22.75 26 13C26 5.82 20.18 0 13 0z" fill="${bg}"/>
    <circle cx="13" cy="12" r="7.5" fill="white" opacity="0.95"/>
    <text x="13" y="16" text-anchor="middle" font-family="sans-serif" font-size="10">${emoji}</text>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [26, 30], iconAnchor: [13, 30], popupAnchor: [0, -30], className: '' });
}

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  pickup_ready: 'Pickup Ready',
  in_transit: 'In Transit',
};

function makeDriverIcon(name, status) {
  const bg = status === 'on_delivery' ? '#059669' : '#0284c7';
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="40" viewBox="0 0 34 40">
    <ellipse cx="17" cy="37" rx="8" ry="2.5" fill="rgba(0,0,0,0.18)"/>
    <path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 23 17 23S34 29.75 34 17C34 7.61 26.39 0 17 0z" fill="${bg}"/>
    <circle cx="17" cy="16" r="10" fill="white" opacity="0.95"/>
    <text x="17" y="20.5" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="${bg}">${initials}</text>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [34, 40], iconAnchor: [17, 40], popupAnchor: [0, -40], className: '' });
}

export default function DispatchOverlayMap({ stores = [], zones = [], orders = [], drivers = [], height = '560px' }) {
  const fitPoints = [
    ...stores.filter(s => s.latitude && s.longitude).map(s => [s.latitude, s.longitude]),
    ...zones.filter(z => z.center_latitude && z.center_longitude).map(z => [z.center_latitude, z.center_longitude]),
    ...orders.filter(o => o.delivery_latitude && o.delivery_longitude).map(o => [o.delivery_latitude, o.delivery_longitude]),
    ...drivers.filter(d => d.current_latitude && d.current_longitude).map(d => [d.current_latitude, d.current_longitude]),
  ];

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border relative">
      <MapContainer center={JEFFERSON_CENTER} zoom={10} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {fitPoints.length > 0 && <FitBounds points={fitPoints} />}
        <CountyOverlay />

        {/* Delivery zone circles */}
        {zones.map(zone =>
          zone.center_latitude && zone.center_longitude && zone.radius_miles ? (
            <Circle
              key={zone.id}
              center={[zone.center_latitude, zone.center_longitude]}
              radius={zone.radius_miles * 1609.34}
              pathOptions={{
                color: zone.is_wet ? '#2563eb' : '#dc2626',
                weight: 2,
                fillColor: zone.is_wet ? '#3b82f6' : '#ef4444',
                fillOpacity: 0.1,
                dashArray: zone.is_wet ? null : '6 4',
              }}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold">{zone.name}</p>
                  <p className="text-xs text-gray-500">{zone.county} County</p>
                  <p className="text-xs mt-1">{zone.is_wet ? '🟢 Wet — deliveries allowed' : '🔴 Dry — no deliveries'}</p>
                  <p className="text-xs">Radius: {zone.radius_miles} mi · Fee: ${zone.delivery_fee}</p>
                  {zone.legal_hours_start && <p className="text-xs">Hours: {zone.legal_hours_start} – {zone.legal_hours_end}</p>}
                </div>
              </Popup>
            </Circle>
          ) : null
        )}

        {/* Store markers */}
        {stores.map(store =>
          store.latitude && store.longitude ? (
            <Marker key={store.id} position={[store.latitude, store.longitude]} icon={makeStoreIcon(store.placement_tier)}>
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold">{store.name}</p>
                  <p className="text-xs text-gray-500">{store.address}, {store.city}</p>
                  <p className="text-xs mt-1">License: {store.license_number}</p>
                  <p className="text-xs">Compliance: <span className={store.compliance_status === 'compliant' ? 'text-green-600' : 'text-red-600'}>{store.compliance_status}</span></p>
                  <p className="text-xs">Hours: {store.operating_hours_start} – {store.operating_hours_end}</p>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}

        {/* Driver location markers */}
        {drivers.map(driver =>
          driver.current_latitude && driver.current_longitude ? (
            <Marker
              key={driver.id}
              position={[driver.current_latitude, driver.current_longitude]}
              icon={makeDriverIcon(driver.name, driver.status)}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold">{driver.name}</p>
                  <p className="text-xs mt-1">
                    Status: <span className={driver.status === 'on_delivery' ? 'text-green-600 font-medium' : 'text-sky-600 font-medium'}>
                      {driver.status === 'on_delivery' ? '🚗 On Delivery' : '✅ Available'}
                    </span>
                  </p>
                  {driver.phone && <p className="text-xs">📞 {driver.phone}</p>}
                  {driver.total_deliveries != null && <p className="text-xs">Deliveries: {driver.total_deliveries}</p>}
                  {driver.avg_rating && <p className="text-xs">⭐ {driver.avg_rating.toFixed(1)}</p>}
                </div>
              </Popup>
            </Marker>
          ) : null
        )}

        {/* Order delivery location markers */}
        {orders.map(order =>
          order.delivery_latitude && order.delivery_longitude ? (
            <Marker
              key={order.id}
              position={[order.delivery_latitude, order.delivery_longitude]}
              icon={makeOrderIcon(order.status)}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold">{order.order_number}</p>
                  <p className="text-xs text-gray-500 truncate">{order.delivery_address}</p>
                  <p className="text-xs mt-1">Customer: {order.customer_name}</p>
                  <p className="text-xs">Store: {order.store_name}</p>
                  <p className="text-xs">Status: <span className="font-medium">{STATUS_LABELS[order.status] || order.status}</span></p>
                  <p className="text-xs">Driver: {order.driver_name || 'Unassigned'}</p>
                  <p className="text-xs font-bold mt-1">${order.total?.toFixed(2)}</p>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur-sm border rounded-lg px-3 py-2.5 text-xs shadow space-y-1.5">
        <p className="font-semibold mb-1">Legend</p>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#1e3a5f] inline-block" /> Store</div>
        <div className="flex items-center gap-2"><span className="w-4 h-3 rounded border-2 border-blue-600 bg-blue-100 inline-block" /> Wet delivery zone</div>
        <div className="flex items-center gap-2"><span className="w-4 h-3 rounded border-dashed border-2 border-red-600 bg-red-100 inline-block" /> Dry zone</div>
        <div className="border-t pt-1 mt-1 font-semibold text-sky-700">Drivers</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#059669] inline-block" /> On delivery</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#0284c7] inline-block" /> Available</div>
        <div className="border-t pt-1 mt-1 font-semibold">Orders</div>
        <div className="flex items-center gap-2"><span className="text-[10px]">⏳</span> Pending</div>
        <div className="flex items-center gap-2"><span className="text-[10px]">📦</span> Pickup ready</div>
        <div className="flex items-center gap-2"><span className="text-[10px]">🚗</span> In transit</div>
      </div>

      {/* Live badge */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-2 shadow">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
        {orders.length} order{orders.length !== 1 ? 's' : ''}
        {drivers.length > 0 && (
          <span className="border-l pl-2 text-sky-700">{drivers.length} driver{drivers.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
}