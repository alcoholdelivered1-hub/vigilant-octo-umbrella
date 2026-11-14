import React, { useEffect, useRef, useState } from 'react';
import { Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import {
  Truck, Navigation, CornerDownRight, CornerDownLeft,
  ArrowUp, ArrowUpRight, ArrowUpLeft, Flag, Merge,
} from 'lucide-react';

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 160) return `${Math.round(meters / 0.3048)} ft`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function formatDistanceSpeech(meters) {
  if (meters == null) return '';
  if (meters < 160) return `${Math.round(meters / 0.3048)} feet`;
  return `${(meters / 1609.34).toFixed(1)} miles`;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  window.speechSynthesis.speak(u);
}

function getManeuverInfo(maneuver) {
  if (!maneuver) return { text: 'Continue', icon: ArrowUp };
  const { type, modifier } = maneuver;
  if (type === 'arrive') return { text: 'Arriving at destination', icon: Flag };
  if (type === 'depart') return { text: 'Starting route', icon: Navigation };
  if (type === 'turn' || type === 'end of road' || type === 'new name') {
    if (modifier === 'left') return { text: 'Turn left', icon: CornerDownLeft };
    if (modifier === 'right') return { text: 'Turn right', icon: CornerDownRight };
    if (modifier === 'slight left') return { text: 'Slight left', icon: ArrowUpLeft };
    if (modifier === 'slight right') return { text: 'Slight right', icon: ArrowUpRight };
    if (modifier === 'sharp left') return { text: 'Sharp left', icon: CornerDownLeft };
    if (modifier === 'sharp right') return { text: 'Sharp right', icon: CornerDownRight };
  }
  if (type === 'continue') return { text: 'Continue straight', icon: ArrowUp };
  if (type === 'merge') return { text: 'Merge ahead', icon: Merge };
  if (type === 'roundabout' || type === 'rotary') return { text: 'Enter roundabout', icon: Navigation };
  if (type === 'fork') {
    if (modifier === 'left') return { text: 'Keep left at fork', icon: ArrowUpLeft };
    if (modifier === 'right') return { text: 'Keep right at fork', icon: ArrowUpRight };
    return { text: 'Stay straight at fork', icon: ArrowUp };
  }
  return { text: 'Continue', icon: ArrowUp };
}

export default function AnimatedDriverMarker({ driver, icon, audioEnabled }) {
  const markerRef = useRef(null);
  const startPos = useRef([driver.lat, driver.lng]);
  const [initialPos] = useState([driver.lat, driver.lng]);
  const [route, setRoute] = useState(null);
  const spokenRef = useRef({ key: '', advance: false, imminent: false });

  const dest = driver.activeOrder;

  // Smooth position interpolation — glides marker from old GPS to new GPS over 3s
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const start = startPos.current;
    const target = [driver.lat, driver.lng];
    if (start[0] === target[0] && start[1] === target[1]) return;

    let startTime = null;
    const duration = 3000;
    let frameId;

    function animate(time) {
      if (!startTime) startTime = time;
      const t = Math.min((time - startTime) / duration, 1);
      const lat = start[0] + (target[0] - start[0]) * t;
      const lng = start[1] + (target[1] - start[1]) * t;
      marker.setLatLng([lat, lng]);
      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        startPos.current = target;
      }
    }
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [driver.lat, driver.lng]);

  // Fetch road route + turn-by-turn steps from OSRM
  useEffect(() => {
    if (!dest?.delivery_latitude || !dest?.delivery_longitude) {
      setRoute(null);
      return;
    }

    let cancelled = false;
    const fetchRoute = () => {
      const url = `https://router.project-osrm.org/route/v1/driving/${driver.lng},${driver.lat};${dest.delivery_longitude},${dest.delivery_latitude}?overview=full&geometries=geojson&steps=true`;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (cancelled || !data.routes?.[0]) return;
          const r = data.routes[0];
          const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const steps = r.legs[0].steps;
          const nextStep = steps.find(s => s.maneuver?.type && s.maneuver.type !== 'depart');
          setRoute({
            coordinates: coords,
            nextManeuver: nextStep
              ? { type: nextStep.maneuver.type, modifier: nextStep.maneuver.modifier, distance: nextStep.distance, road: nextStep.name }
              : null,
            totalDistance: r.distance,
            totalDuration: r.duration,
          });
        })
        .catch(() => {
          // Fallback: straight line if routing fails
          if (!cancelled) {
            setRoute({
              coordinates: [[driver.lat, driver.lng], [dest.delivery_latitude, dest.delivery_longitude]],
              nextManeuver: null,
              totalDistance: null,
              totalDuration: null,
            });
          }
        });
    };

    fetchRoute();
    const interval = setInterval(fetchRoute, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [dest?.delivery_latitude, dest?.delivery_longitude, driver.lat, driver.lng]);

  const maneuverInfo = route?.nextManeuver ? getManeuverInfo(route.nextManeuver) : null;
  const ManeuverIcon = maneuverInfo?.icon || ArrowUp;
  const distText = route?.nextManeuver ? formatDistance(route.nextManeuver.distance) : '';

  // Audio cues — speak advance + imminent maneuvers
  useEffect(() => {
    if (!audioEnabled || !route?.nextManeuver || !maneuverInfo) return;
    const nm = route.nextManeuver;
    const key = `${nm.type}-${nm.modifier || ''}-${nm.road || ''}`;
    const tracked = spokenRef.current;

    if (key !== tracked.key) {
      tracked.key = key;
      tracked.advance = false;
      tracked.imminent = false;
    }

    if (!tracked.advance) {
      let text = maneuverInfo.text;
      const distSpoken = formatDistanceSpeech(nm.distance);
      if (distSpoken) text += ` in ${distSpoken}`;
      if (nm.road) text += ` onto ${nm.road}`;
      speak(text);
      tracked.advance = true;
    }

    if (!tracked.imminent && nm.distance != null && nm.distance < 150 && nm.type !== 'arrive') {
      speak(`${maneuverInfo.text} now`);
      tracked.imminent = true;
    }
  }, [audioEnabled, route?.nextManeuver, maneuverInfo]);

  return (
    <>
      <Marker ref={markerRef} position={initialPos} icon={icon}>
        <Popup>
          <div className="text-sm min-w-[180px]">
            <p className="font-bold flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-primary" /> {driver.name}
            </p>
            <p className="text-muted-foreground capitalize mt-0.5">{driver.status?.replace('_', ' ')}</p>
            {dest && (
              <div className="mt-2 pt-2 border-t space-y-0.5">
                <p className="font-semibold text-xs text-primary">Delivering: {dest.order_number}</p>
                <p className="text-xs text-muted-foreground">{dest.customer_name}</p>
                <p className="text-xs text-muted-foreground">{dest.delivery_address}</p>
                {route?.totalDistance && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    <p className="text-xs font-semibold">
                      Route: {formatDistance(route.totalDistance)}
                      {route.totalDuration ? ` · ${Math.round(route.totalDuration / 60)} min` : ''}
                    </p>
                    {maneuverInfo && (
                      <p className="text-xs flex items-center gap-1">
                        <ManeuverIcon className="w-3 h-3 text-primary" />
                        {maneuverInfo.text}{distText ? ` in ${distText}` : ''}
                        {route.nextManeuver?.road ? ` onto ${route.nextManeuver.road}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Popup>

        {/* Permanent maneuver tooltip above the driver marker */}
        {maneuverInfo && (
          <Tooltip permanent direction="top" offset={[0, -48]} className="driver-maneuver-tooltip">
            <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
              <ManeuverIcon className="w-3 h-3 text-blue-600" />
              <span>{maneuverInfo.text}</span>
              {distText && <span className="text-slate-500 font-medium">· {distText}</span>}
            </div>
          </Tooltip>
        )}
      </Marker>

      {/* Road route polyline */}
      {route && (
        <Polyline
          positions={route.coordinates}
          color="#1d4ed8"
          weight={4}
          opacity={0.75}
          lineCap="round"
          lineJoin="round"
        />
      )}
    </>
  );
}