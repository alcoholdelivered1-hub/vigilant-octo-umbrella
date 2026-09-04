import React, { useEffect, useState } from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

function formatDistance(meters) {
  if (meters == null) return '';
  if (meters < 160) return `${Math.round(meters / 0.3048)} ft`;
  return `${(meters / 1609.34).toFixed(1)} mi`;
}

function makeNumberedStopIcon(number, isNext) {
  const color = isNext ? '#dc2626' : '#0891b2';
  const ring = isNext ? '#fca5a5' : '#a5f3fc';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <ellipse cx="17" cy="40" rx="7" ry="2.5" fill="rgba(0,0,0,0.15)"/>
      <path d="M17 0C7.61 0 0 7.61 0 17c0 12.75 17 25 17 25S34 29.75 34 17C34 7.61 26.39 0 17 0z" fill="${color}"/>
      <circle cx="17" cy="16" r="11" fill="white"/>
      <circle cx="17" cy="16" r="11" fill="none" stroke="${ring}" stroke-width="2"/>
      <text x="17" y="21" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="800" fill="${color}">${number}</text>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [34, 42], iconAnchor: [17, 42], popupAnchor: [0, -42], className: '' });
}

export default function OptimizedRouteOverlay({ driver, stops }) {
  const [optimized, setOptimized] = useState(null);

  const stopsKey = stops.map(s => s.id).join(',');

  useEffect(() => {
    const validStops = stops.filter(s => s.delivery_latitude && s.delivery_longitude);
    if (validStops.length < 2 || !driver.lat || !driver.lng) {
      setOptimized(null);
      return;
    }

    let cancelled = false;
    const fetchOptimized = () => {
      const coords = [
        `${driver.lng},${driver.lat}`,
        ...validStops.map(s => `${s.delivery_longitude},${s.delivery_latitude}`),
      ].join(';');
      const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=full&geometries=geojson`;

      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (cancelled || !data.trips?.[0]) return;
          const trip = data.trips[0];
          const routeCoords = trip.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

          // waypoints[0] = driver start; waypoints[1..N] = input stops in submission order
          // waypoint_index = visit position in optimized route
          const orderedStops = data.waypoints
            .slice(1)
            .map((w, inputIdx) => ({ stop: validStops[inputIdx], pos: w.waypoint_index }))
            .sort((a, b) => a.pos - b.pos)
            .map((item, idx) => ({ ...item.stop, order: idx + 1 }));

          setOptimized({
            coordinates: routeCoords,
            orderedStops,
            totalDistance: trip.distance,
            totalDuration: trip.duration,
          });
        })
        .catch(() => { if (!cancelled) setOptimized(null); });
    };

    fetchOptimized();
    const interval = setInterval(fetchOptimized, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [driver.lat, driver.lng, stopsKey]);

  if (!optimized) return null;

  return (
    <>
      <Polyline
        positions={optimized.coordinates}
        color="#0891b2"
        weight={5}
        opacity={0.55}
        dashArray="10 6"
        lineCap="round"
        lineJoin="round"
      />
      {optimized.orderedStops.map((stop, idx) => (
        <Marker
          key={`opt-${stop.id || idx}`}
          position={[stop.delivery_latitude, stop.delivery_longitude]}
          icon={makeNumberedStopIcon(stop.order, idx === 0)}
        >
          <Tooltip permanent direction="top" offset={[0, -44]} className="driver-maneuver-tooltip">
            <div className="text-xs font-bold whitespace-nowrap">
              Stop {stop.order} · {stop.customer_name || stop.order_number}
            </div>
            {idx === 0 && optimized.totalDistance != null && (
              <div className="text-[10px] text-slate-500 font-medium">
                {formatDistance(optimized.totalDistance)}
                {optimized.totalDuration ? ` · ${Math.round(optimized.totalDuration / 60)} min total` : ''}
              </div>
            )}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}