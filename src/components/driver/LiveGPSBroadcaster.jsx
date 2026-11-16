import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Satellite, X, Minimize2, Maximize2 } from 'lucide-react';

/**
 * While mounted, watches the device GPS and pushes coordinates every 10 seconds to:
 *  - All in_transit orders assigned to this driver
 *  - The Driver entity record (for the admin dispatch map)
 *
 * Debug mode (visible overlay): activate with ?debug_gps=1 in the URL.
 */
export default function LiveGPSBroadcaster({ driverId, driverEmail, debug: debugProp }) {
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const locationRef = useRef(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Debug state
  const debug = debugProp ?? new URLSearchParams(window.location.search).has('debug_gps');
  const [gpsState, setGpsState] = useState({
    lat: null, lng: null, accuracy: null, lastFix: null, available: !!navigator.geolocation,
  });
  const [pushState, setPushState] = useState({ lastPush: null, lastResult: null, count: 0, error: null });
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ((!driverId && !driverEmail) || !navigator.geolocation) return;

    // Watch GPS position
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          lastFix: new Date().toISOString(),
          available: true,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          toast.error('GPS access denied. Enable location in your browser to share your position.');
        }
        setGpsState(s => ({ ...s, available: false }));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    const push = async () => {
      if (!locationRef.current) return;
      const { lat, lng } = locationRef.current;
      try {
        const res = await base44.functions.invoke('updateDriverLocation', { latitude: lat, longitude: lng });
        setPushState(s => ({ lastPush: new Date().toISOString(), lastResult: res, count: s.count + 1, error: null }));
      } catch (err) {
        console.error('LiveGPSBroadcaster push error:', err);
        setPushState(s => ({ lastPush: new Date().toISOString(), lastResult: null, count: s.count, error: err.message || String(err) }));
      }
    };

    // Push immediately, then every 10s
    push();
    intervalRef.current = setInterval(push, 10000);

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [driverId, driverEmail]);

  if (!debug || hidden) return null;

  const timeSince = (iso) => {
    if (!iso) return 'never';
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
  };

  return (
    <div className="fixed bottom-4 left-4 z-[70] w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground">
        <span className="flex items-center gap-1.5 font-bold">
          <Satellite className="w-3.5 h-3.5" />
          GPS DEBUG
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setCollapsed(c => !c)} className="p-1 hover:bg-white/20 rounded">
            {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button onClick={() => setHidden(true)} className="p-1 hover:bg-white/20 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">GPS</span>
            <span className={`font-bold ${gpsState.available ? 'text-emerald-600' : 'text-red-600'}`}>
              {permissionDenied ? 'DENIED' : gpsState.available ? 'ACTIVE' : 'SEARCHING…'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Latitude</span>
            <span className="font-bold">{gpsState.lat?.toFixed(6) ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Longitude</span>
            <span className="font-bold">{gpsState.lng?.toFixed(6) ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Accuracy</span>
            <span className="font-bold">{gpsState.accuracy ? `±${gpsState.accuracy.toFixed(0)}m` : '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last Fix</span>
            <span>{timeSince(gpsState.lastFix)}</span>
          </div>
          <div className="border-t pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pushes</span>
              <span className="font-bold">{pushState.count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Last Push</span>
              <span>{timeSince(pushState.lastPush)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Result</span>
              <span className={`font-bold ${pushState.error ? 'text-red-600' : pushState.lastResult ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                {pushState.error ? 'ERROR' : pushState.lastResult ? 'OK' : '—'}
              </span>
            </div>
            {pushState.error && (
              <div className="text-red-600 text-[10px] break-all bg-red-50 rounded p-1.5">
                {pushState.error}
              </div>
            )}
            {pushState.lastResult && (
              <div className="text-[10px] text-muted-foreground break-all bg-muted rounded p-1.5">
                {JSON.stringify(pushState.lastResult)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}