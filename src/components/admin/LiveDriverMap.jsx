import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Package, Layers, Navigation, Volume2, VolumeX, Route } from 'lucide-react';
import AnimatedDriverMarker from '@/components/admin/AnimatedDriverMarker';
import OptimizedRouteOverlay from '@/components/admin/OptimizedRouteOverlay';

const TILE_LAYERS = {
  street: {
    label: 'Street',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
  dark: {
    label: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PINE_BLUFF_CENTER = [34.2284, -92.0032];

function makeDriverIcon(name, status) {
  const color = status === 'in_transit' ? '#1d4ed8' : status === 'on_delivery' ? '#d97706' : '#6b7280';
  const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
      <ellipse cx="18" cy="41" rx="8" ry="3" fill="rgba(0,0,0,0.2)"/>
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}"/>
      <circle cx="18" cy="17" r="12" fill="white" opacity="0.95"/>
      <text x="18" y="22" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="${color}">${initials}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
    className: '',
  });
}

function makeDeliveryIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 20 14 20S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="#ef4444"/>
      <circle cx="14" cy="13" r="7" fill="white" opacity="0.9"/>
      <rect x="10" y="9" width="8" height="8" rx="1" fill="#ef4444"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34],
    className: '',
  });
}

function makeStoreIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 20 14 20S28 24.5 28 14C28 6.27 21.73 0 14 0z" fill="#7c3aed"/>
      <circle cx="14" cy="13" r="7" fill="white" opacity="0.9"/>
      <text x="14" y="17.5" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#7c3aed">🏪</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [28, 34],
    iconAnchor: [14, 34],
    popupAnchor: [0, -34],
    className: '',
  });
}

// Pan map to follow a target position smoothly
function MapFollowController({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.panTo(target, { animate: true, duration: 1.5 });
    }
  }, [target?.[0], target?.[1]]);
  return null;
}

// Auto-fit map to all markers
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
    }
  }, [points.length]);
  return null;
}

// Fix gray/missing tiles by forcing Leaflet to recalculate container size
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    const interval = setInterval(() => map.invalidateSize(), 3000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [map]);
  return null;
}

export default function LiveDriverMap({ height = '500px' }) {
  const [tileLayer, setTileLayer] = useState('street');
  const [showTileMenu, setShowTileMenu] = useState(false);
  const [followEnabled, setFollowEnabled] = useState(false);
  const [followDriverId, setFollowDriverId] = useState(null);
  const [showDriverMenu, setShowDriverMenu] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [optimizeEnabled, setOptimizeEnabled] = useState(false);

  // Active in-transit orders
  const { data: orders = [] } = useQuery({
    queryKey: ['live-map-orders'],
    queryFn: () => base44.entities.Order.filter({ status: { $in: ['in_transit', 'pickup_ready'] } }),
    refetchInterval: 8000,
  });

  // All drivers that are active
  const { data: drivers = [] } = useQuery({
    queryKey: ['live-map-drivers'],
    queryFn: () => base44.entities.Driver.filter({ status: { $in: ['available', 'on_delivery'] }, is_active: true }),
    refetchInterval: 8000,
  });

  // Real-time subscriptions
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const u1 = base44.entities.Order.subscribe(() => forceUpdate(n => n + 1));
    const u2 = base44.entities.Driver.subscribe(() => forceUpdate(n => n + 1));
    return () => { u1(); u2(); };
  }, []);

  // Merge driver GPS from orders (live location) onto driver objects
  const driverLocations = drivers.map(driver => {
    const driverOrders = orders.filter(o => o.driver_id === driver.id);
    const liveOrder = driverOrders.find(o => o.driver_current_latitude);
    return {
      ...driver,
      lat: liveOrder?.driver_current_latitude || driver.current_latitude,
      lng: liveOrder?.driver_current_longitude || driver.current_longitude,
      activeOrder: liveOrder || driverOrders[0],
      stops: driverOrders,
    };
  }).filter(d => d.lat && d.lng);

  // Collect all renderable points for FitBounds
  const allPoints = [];
  driverLocations.forEach(d => allPoints.push([d.lat, d.lng]));
  orders.forEach(o => {
    if (o.delivery_latitude && o.delivery_longitude) allPoints.push([o.delivery_latitude, o.delivery_longitude]);
  });

  const driverIcon = (d) => makeDriverIcon(d.name, d.activeOrder ? 'in_transit' : d.status);

  return (
    <div style={{ height }} className="rounded-xl overflow-hidden border relative">
      <MapContainer
        center={PINE_BLUFF_CENTER}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          key={tileLayer}
          attribution={TILE_LAYERS[tileLayer].attribution}
          url={TILE_LAYERS[tileLayer].url}
        />

        {allPoints.length > 0 && <FitBounds points={allPoints} />}
        <InvalidateSize />

        {/* Follow selected driver */}
        {followEnabled && (() => {
          const targetDriver = followDriverId
            ? driverLocations.find(d => d.id === followDriverId)
            : driverLocations[0];
          return targetDriver ? <MapFollowController target={[targetDriver.lat, targetDriver.lng]} /> : null;
        })()}

        {/* Driver markers — smooth movement + turn-by-turn routing */}
        {driverLocations.map(driver => (
          <AnimatedDriverMarker key={driver.id} driver={driver} icon={driverIcon(driver)} audioEnabled={audioEnabled} />
        ))}

        {/* Optimized multi-stop routes */}
        {optimizeEnabled && driverLocations.map(driver => (
          driver.stops && driver.stops.length >= 2 ? (
            <OptimizedRouteOverlay key={`opt-${driver.id}`} driver={driver} stops={driver.stops} />
          ) : null
        ))}

        {/* Delivery destination markers */}
        {orders
          .filter(o => o.delivery_latitude && o.delivery_longitude)
          .map(order => (
            <Marker
              key={`dest-${order.id}`}
              position={[order.delivery_latitude, order.delivery_longitude]}
              icon={makeDeliveryIcon()}
            >
              <Popup>
                <div className="text-sm min-w-[160px]">
                  <p className="font-bold flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-red-500" /> {order.order_number}
                  </p>
                  <p className="text-muted-foreground mt-0.5">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{order.delivery_address}</p>
                  {order.driver_name && <p className="text-xs font-medium mt-1">Driver: {order.driver_name}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 text-xs space-y-1.5 shadow">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-700 inline-block" /> Driver (available)</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> Driver (on delivery)</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Delivery destination</div>
        <div className="flex items-center gap-2"><span className="w-6 border-t-2 border-blue-700 border-dashed inline-block" /> Route</div>
        <div className="flex items-center gap-2"><span className="w-6 border-t-2 border-cyan-600 border-dashed inline-block" /> Optimized route</div>
      </div>

      {/* Tile style switcher */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
        <div className="relative flex items-center">
          <button
            onClick={() => setFollowEnabled(v => !v)}
            className={`border rounded-l-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow transition-colors ${
              followEnabled ? 'bg-primary text-primary-foreground' : 'bg-background/95 hover:bg-muted/50'
            }`}
          >
            <Navigation className={`w-3.5 h-3.5 ${followEnabled ? 'animate-pulse' : ''}`} />
            {followEnabled ? 'Following' : 'Follow'}
          </button>
          <button
            onClick={() => setShowDriverMenu(v => !v)}
            className={`border-y border-r rounded-r-full px-2 py-1 text-xs font-semibold shadow transition-colors ${
              followEnabled ? 'bg-primary text-primary-foreground' : 'bg-background/95 hover:bg-muted/50'
            }`}
          >
            ▾
          </button>
          {showDriverMenu && (
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setShowDriverMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-[1001] bg-background border rounded-lg shadow-lg overflow-hidden w-48 max-h-64 overflow-y-auto">
                {driverLocations.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No drivers online</p>
                ) : driverLocations.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setFollowDriverId(d.id); setFollowEnabled(true); setShowDriverMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors ${
                      followDriverId === d.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                    {d.name}
                    <span className="ml-auto text-muted-foreground">{d.status === 'on_delivery' ? 'Delivering' : 'Available'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => setAudioEnabled(v => !v)}
          className={`border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow transition-colors ${
            audioEnabled ? 'bg-primary text-primary-foreground' : 'bg-background/95 hover:bg-muted/50'
          }`}
        >
          {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {audioEnabled ? 'Voice On' : 'Voice'}
        </button>
        <button
          onClick={() => setOptimizeEnabled(v => !v)}
          className={`border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow transition-colors ${
            optimizeEnabled ? 'bg-primary text-primary-foreground' : 'bg-background/95 hover:bg-muted/50'
          }`}
        >
          <Route className={`w-3.5 h-3.5 ${optimizeEnabled ? 'animate-pulse' : ''}`} />
          {optimizeEnabled ? 'Optimized' : 'Optimize'}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowTileMenu(v => !v)}
            className="bg-background/95 border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow hover:bg-muted/50 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" /> {TILE_LAYERS[tileLayer].label}
          </button>
          {showTileMenu && (
            <>
              <div className="fixed inset-0 z-[999]" onClick={() => setShowTileMenu(false)} />
              <div className="absolute right-0 mt-1 z-[1001] bg-background border rounded-lg shadow-lg overflow-hidden w-28">
                {Object.entries(TILE_LAYERS).map(([key, layer]) => (
                  <button
                    key={key}
                    onClick={() => { setTileLayer(key); setShowTileMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                      tileLayer === key ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                    }`}
                  >
                    {layer.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Live badge */}
        <div className="bg-background/95 border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Live · {driverLocations.length} driver{driverLocations.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}