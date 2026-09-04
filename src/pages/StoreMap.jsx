import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Store, Navigation, Crosshair, Loader2, MapPin, Phone, Clock, ArrowLeft } from 'lucide-react';

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PINE_BLUFF_CENTER = [34.2204, -92.0033];

function makeStoreIcon(tier, isNearest) {
  const fill = isNearest ? '#16a34a' : tier === 'premium' ? '#7c3aed' : tier === 'featured' ? '#d97706' : '#1e3a5f';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">
      <ellipse cx="15" cy="33" rx="7" ry="2.5" fill="rgba(0,0,0,0.18)"/>
      <path d="M15 0C6.72 0 0 6.72 0 15c0 11.25 15 21 15 21S30 26.25 30 15C30 6.72 23.28 0 15 0z" fill="${fill}"/>
      <circle cx="15" cy="14" r="8.5" fill="white" opacity="0.95"/>
      <text x="15" y="18.5" text-anchor="middle" font-family="sans-serif" font-size="12">🏪</text>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [30, 36], iconAnchor: [15, 36], popupAnchor: [0, -36], className: '' });
}

function makeUserIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#2563eb" fill-opacity="0.2" stroke="#2563eb" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="#2563eb"/>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [24, 24], iconAnchor: [12, 12], className: '' });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.setView(PINE_BLUFF_CENTER, 11);
    }
  }, [points.length]);
  return null;
}

// Haversine distance in miles
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const tierLabel = { premium: 'Premium', featured: 'Featured', standard: 'Standard' };

export default function StoreMap() {
  const [search, setSearch] = useState('');
  const [userLoc, setUserLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const mapRef = useRef(null);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['store-map-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }),
  });

  const storesWithCoords = stores.filter(s => s.latitude && s.longitude);

  // Compute distances
  const storesWithDistance = storesWithCoords.map(s => ({
    ...s,
    distance: userLoc ? distanceMiles(userLoc.lat, userLoc.lon, s.latitude, s.longitude) : null,
  }));

  const filtered = storesWithDistance
    .filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase()) ||
      s.address?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (a.distance != null && b.distance != null) return a.distance - b.distance;
      if (a.distance != null) return -1;
      if (b.distance != null) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const nearest = filtered[0];
  const fitPoints = storesWithCoords.map(s => [s.latitude, s.longitude]);

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const focusStore = (store) => {
    setSelectedId(store.id);
    if (mapRef.current && store.latitude && store.longitude) {
      mapRef.current.setView([store.latitude, store.longitude], 14);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <Link to="/stores" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Stores
          </Link>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <MapPin className="w-7 h-7 text-primary" /> Store Pickup Map
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {storesWithCoords.length} active retail locations with GPS coordinates
          </p>
        </div>
        <button
          onClick={requestLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {userLoc ? 'Update My Location' : 'Find Nearest Store'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        {/* Map */}
        <div className="rounded-2xl overflow-hidden border relative" style={{ height: '600px' }}>
          <MapContainer
            center={PINE_BLUFF_CENTER}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            ref={(ref) => { mapRef.current = ref; }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {fitPoints.length > 0 && <FitBounds points={fitPoints} />}

            {userLoc && (
              <Marker position={[userLoc.lat, userLoc.lon]} icon={makeUserIcon()}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold">Your Location</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {filtered.map(store => (
              <Marker
                key={store.id}
                position={[store.latitude, store.longitude]}
                icon={makeStoreIcon(store.placement_tier, nearest?.id === store.id && !!userLoc)}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <p className="font-bold">{store.name}</p>
                    <p className="text-muted-foreground text-xs">{store.address}, {store.city}</p>
                    {store.distance != null && (
                      <p className="text-emerald-600 font-semibold text-xs mt-1">
                        {store.distance.toFixed(1)} miles away
                      </p>
                    )}
                    <div className="mt-2 space-y-0.5 text-xs">
                      {store.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {store.phone}</p>}
                      {store.operating_hours_start && (
                        <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> {store.operating_hours_start}–{store.operating_hours_end}</p>
                      )}
                      <p><span className="font-medium">Tier:</span> {tierLabel[store.placement_tier] || store.placement_tier}</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                    >
                      <Navigation className="w-3 h-3" /> Get Directions
                    </a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2.5 text-xs space-y-1.5 shadow">
            <p className="font-semibold text-xs mb-1 text-foreground">Legend</p>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#1e3a5f] inline-block" /> Standard</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> Featured</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-violet-600 inline-block" /> Premium</div>
            {userLoc && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" /> Nearest</div>}
            {userLoc && <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> You</div>}
          </div>
        </div>

        {/* Sidebar list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search stores..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {userLoc && filtered.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
              <p className="text-emerald-800 font-semibold flex items-center gap-1.5">
                <Navigation className="w-4 h-4" /> Nearest: {nearest?.name}
              </p>
              <p className="text-emerald-700 text-xs mt-0.5">{nearest?.distance?.toFixed(1)} miles · {nearest?.address}</p>
            </div>
          )}

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            ) : filtered.length === 0 ? (
              <div className="text-center py-10">
                <Store className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground mt-3 text-sm">No stores found</p>
              </div>
            ) : (
              filtered.map(store => (
                <button
                  key={store.id}
                  onClick={() => focusStore(store)}
                  className={`w-full text-left bg-card border rounded-xl p-3 transition-all hover:border-primary/50 ${selectedId === store.id ? 'border-primary ring-1 ring-primary/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{store.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{store.address}, {store.city}</p>
                    </div>
                    {store.distance != null && (
                      <span className="text-xs font-bold text-emerald-600 shrink-0">{store.distance.toFixed(1)} mi</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {store.operating_hours_start && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {store.operating_hours_start}–{store.operating_hours_end}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{tierLabel[store.placement_tier] || 'Standard'}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}