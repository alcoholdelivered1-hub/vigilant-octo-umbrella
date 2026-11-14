import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Store, MapPin, ShieldCheck } from 'lucide-react';

// Fix default Leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Jefferson County, AR center
const JEFFERSON_COUNTY_CENTER = [34.2284, -92.0032];

// Jefferson County approximate boundary polygon (GeoJSON coords → [lat, lng])
// Rough polygon for visual reference
const JEFFERSON_COUNTY_BOUNDS = [
  [34.4950, -92.2300],
  [34.4950, -91.7500],
  [34.0000, -91.7500],
  [34.0000, -92.2300],
];

function makeStoreIcon(tier) {
  const fill = tier === 'premium' ? '#7c3aed' : tier === 'featured' ? '#d97706' : '#1e3a5f';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">
      <ellipse cx="15" cy="33" rx="7" ry="2.5" fill="rgba(0,0,0,0.18)"/>
      <path d="M15 0C6.72 0 0 6.72 0 15c0 11.25 15 21 15 21S30 26.25 30 15C30 6.72 23.28 0 15 0z" fill="${fill}"/>
      <circle cx="15" cy="14" r="8.5" fill="white" opacity="0.95"/>
      <text x="15" y="18.5" text-anchor="middle" font-family="sans-serif" font-size="12">🏪</text>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [30, 36], iconAnchor: [15, 36], popupAnchor: [0, -36], className: '' });
}

// Auto-fit to all stores + zone centers
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 13 });
    } else {
      map.setView(JEFFERSON_COUNTY_CENTER, 10);
    }
  }, [points.length]);
  return null;
}

// Jefferson County boundary overlay using a rectangle shape
function JeffersonCountyOverlay() {
  const map = useMap();
  useEffect(() => {
    const rectangle = L.rectangle(
      [[34.0, -92.23], [34.495, -91.75]],
      {
        color: '#1e3a5f',
        weight: 2.5,
        dashArray: '8 5',
        fillColor: '#1e3a5f',
        fillOpacity: 0.05,
      }
    ).addTo(map);
    rectangle.bindTooltip('Jefferson County Service Area', {
      permanent: false,
      direction: 'top',
      className: 'leaflet-tooltip-county',
    });
    return () => rectangle.remove();
  }, []);
  return null;
}

export default function ServiceAreaMap({ height = '480px' }) {
  const { data: stores = [] } = useQuery({
    queryKey: ['service-area-stores'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }),
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['service-area-zones'],
    queryFn: () => base44.entities.DeliveryZone.filter({ is_active: true }),
  });

  // Build fit-bounds points from stores and zone centers
  const fitPoints = [
    ...stores.filter(s => s.latitude && s.longitude).map(s => [s.latitude, s.longitude]),
    ...zones.filter(z => z.center_latitude && z.center_longitude).map(z => [z.center_latitude, z.center_longitude]),
  ];

  const tierLabel = { premium: 'Premium', featured: 'Featured', standard: 'Standard' };

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-3 py-1.5">
          <Store className="w-3.5 h-3.5 text-primary" />
          <span className="font-medium">{stores.length}</span>
          <span className="text-muted-foreground">Active Stores</span>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/60 rounded-lg px-3 py-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium">{zones.length}</span>
          <span className="text-muted-foreground">Delivery Zones</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-medium">Jefferson County Only</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ height }} className="rounded-xl overflow-hidden border relative">
        <MapContainer
          center={JEFFERSON_COUNTY_CENTER}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {fitPoints.length > 0 && <FitBounds points={fitPoints} />}

          {/* Jefferson County service boundary */}
          <JeffersonCountyOverlay />

          {/* Delivery zone circles */}
          {zones.map(zone => (
            zone.center_latitude && zone.center_longitude && zone.radius_miles ? (
              <Circle
                key={zone.id}
                center={[zone.center_latitude, zone.center_longitude]}
                radius={zone.radius_miles * 1609.34}
                pathOptions={{
                  color: zone.is_wet ? '#2563eb' : '#dc2626',
                  weight: 2,
                  fillColor: zone.is_wet ? '#3b82f6' : '#ef4444',
                  fillOpacity: 0.12,
                  dashArray: zone.is_wet ? null : '6 4',
                }}
              >
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <p className="font-bold">{zone.name}</p>
                    <p className="text-muted-foreground">{zone.county} County</p>
                    <div className="mt-1.5 space-y-0.5 text-xs">
                      <p><span className="font-medium">Status:</span> {zone.is_wet ? '🟢 Wet — deliveries allowed' : '🔴 Dry — no deliveries'}</p>
                      <p><span className="font-medium">Radius:</span> {zone.radius_miles} mi</p>
                      {zone.legal_hours_start && (
                        <p><span className="font-medium">Hours:</span> {zone.legal_hours_start} – {zone.legal_hours_end}</p>
                      )}
                      {zone.delivery_fee != null && (
                        <p><span className="font-medium">Delivery fee:</span> ${zone.delivery_fee}</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Circle>
            ) : null
          ))}

          {/* Store markers */}
          {stores.map(store => (
            store.latitude && store.longitude ? (
              <Marker
                key={store.id}
                position={[store.latitude, store.longitude]}
                icon={makeStoreIcon(store.placement_tier)}
              >
                <Popup>
                  <div className="text-sm min-w-[170px]">
                    <p className="font-bold">{store.name}</p>
                    <p className="text-muted-foreground text-xs">{store.address}, {store.city}</p>
                    <div className="mt-1.5 space-y-0.5 text-xs">
                      <p><span className="font-medium">License:</span> {store.license_number}</p>
                      <p><span className="font-medium">County:</span> {store.county}</p>
                      <p><span className="font-medium">Tier:</span> {tierLabel[store.placement_tier] || store.placement_tier}</p>
                      <p><span className="font-medium">Compliance:</span> <span className={store.compliance_status === 'compliant' ? 'text-emerald-600' : 'text-red-600'}>{store.compliance_status}</span></p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ) : null
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2.5 text-xs space-y-1.5 shadow">
          <p className="font-semibold text-xs mb-1 text-foreground">Legend</p>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#1e3a5f] inline-block" /> Store (standard)</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> Store (featured)</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-violet-600 inline-block" /> Store (premium)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-3 rounded border-2 border-blue-600 bg-blue-100 inline-block" /> Wet delivery zone</div>
          <div className="flex items-center gap-2"><span className="w-4 h-3 rounded border-2 border-dashed border-red-600 bg-red-100 inline-block" /> Dry zone (no delivery)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-3 rounded border-[1.5px] border-dashed border-[#1e3a5f] bg-[#1e3a5f]/5 inline-block" /> Jefferson County boundary</div>
        </div>

        {/* Zone count badge */}
        <div className="absolute top-3 right-3 z-[1000] bg-background/95 border rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          {zones.filter(z => z.is_wet).length} wet zone{zones.filter(z => z.is_wet).length !== 1 ? 's' : ''} active
        </div>
      </div>
    </div>
  );
}