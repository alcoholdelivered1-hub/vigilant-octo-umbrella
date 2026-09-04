import React, { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck } from 'lucide-react';
import { format } from 'date-fns';

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  html: `<div style="background:#1e3a8a;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
  className: '',
});

const destinationIcon = L.divIcon({
  html: `<div style="background:#f59e0b;border-radius:50% 50% 50% 0;width:32px;height:32px;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;width:100%;height:100%">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: '',
});

// Inner component to smoothly pan map when driver moves
function MapController({ driverLocation, deliveryLocation }) {
  const map = useMap();
  const prevLocation = useRef(null);

  useEffect(() => {
    if (!driverLocation) return;
    const { latitude: lat, longitude: lng } = driverLocation;
    // Only pan if the driver has actually moved
    if (
      prevLocation.current &&
      prevLocation.current.latitude === lat &&
      prevLocation.current.longitude === lng
    ) return;

    prevLocation.current = driverLocation;

    if (deliveryLocation?.latitude && deliveryLocation?.longitude) {
      // Fit both driver + destination in view
      const bounds = L.latLngBounds(
        [lat, lng],
        [deliveryLocation.latitude, deliveryLocation.longitude]
      );
      map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 1 });
    } else {
      map.panTo([lat, lng], { animate: true, duration: 1 });
    }
  }, [driverLocation, deliveryLocation, map]);

  return null;
}

export default function DriverMap({ driverLocation, deliveryLocation, driverName, lastUpdatedAt }) {
  const center = useMemo(() => {
    if (driverLocation?.latitude) return [driverLocation.latitude, driverLocation.longitude];
    if (deliveryLocation?.latitude) return [deliveryLocation.latitude, deliveryLocation.longitude];
    return [34.2283, -92.0032]; // Pine Bluff, AR fallback
  }, [driverLocation, deliveryLocation]);

  const hasRoute = driverLocation?.latitude && deliveryLocation?.latitude;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Truck className="w-4 h-4 text-primary" />
          <span>{driverName} is on the way</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        {lastUpdatedAt && (
          <span className="text-xs text-muted-foreground">
            Updated {format(new Date(lastUpdatedAt), 'h:mm:ss a')}
          </span>
        )}
      </div>

      <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ height: '340px' }}>
        <MapContainer
          center={center}
          zoom={14}
          style={{ width: '100%', height: '100%' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          />

          <MapController driverLocation={driverLocation} deliveryLocation={deliveryLocation} />

          {driverLocation?.latitude && (
            <Marker position={[driverLocation.latitude, driverLocation.longitude]} icon={driverIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{driverName}</p>
                  <p className="text-xs text-gray-500">Live location</p>
                </div>
              </Popup>
            </Marker>
          )}

          {deliveryLocation?.latitude && (
            <Marker position={[deliveryLocation.latitude, deliveryLocation.longitude]} icon={destinationIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">Your address</p>
                  <p className="text-xs text-gray-500">{deliveryLocation.address}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {hasRoute && (
            <Polyline
              positions={[
                [driverLocation.latitude, driverLocation.longitude],
                [deliveryLocation.latitude, deliveryLocation.longitude],
              ]}
              color="#1e3a8a"
              weight={3}
              opacity={0.6}
              dashArray="8, 6"
            />
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-primary inline-block"></span> Driver
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-secondary inline-block"></span> Your address
        </span>
        {!driverLocation?.latitude && (
          <span className="text-amber-600">Waiting for driver GPS...</span>
        )}
      </div>
    </div>
  );
}