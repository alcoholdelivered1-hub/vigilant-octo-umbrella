import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Pine Bluff, AR default center
const PINE_BLUFF = [34.2284, -92.0032];

export default function DriverLocationMap() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device.');
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError('Location access denied. Please enable location permissions.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const center = location ? [location.lat, location.lng] : PINE_BLUFF;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" /> Your Location
        </p>
        {loading && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Locating…</span>}
        {location && <span className="text-xs text-emerald-600 font-medium">● Live</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border bg-muted h-52">
        <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {location && (
            <>
              <Marker position={[location.lat, location.lng]}>
                <Popup><span className="text-sm font-semibold">You are here</span></Popup>
              </Marker>
              <Circle
                center={[location.lat, location.lng]}
                radius={100}
                pathOptions={{ color: 'hsl(234, 62%, 26%)', fillColor: 'hsl(234, 62%, 26%)', fillOpacity: 0.15, weight: 2 }}
              />
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}