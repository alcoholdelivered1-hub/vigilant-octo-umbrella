import { calculateDistance } from './distanceUtils';

/**
 * Given a lat/lon and a list of DeliveryZone records,
 * returns the matching active zone (smallest radius that contains the point),
 * or null if no zone matches.
 */
export function findZoneForLocation(lat, lon, zones) {
  if (!lat || !lon || !zones?.length) return null;

  const matching = zones
    .filter(z => z.is_active && z.is_wet && (z.zone_status || 'active') === 'active' && z.center_latitude && z.center_longitude && z.radius_miles)
    .map(z => ({
      zone: z,
      distance: calculateDistance(lat, lon, z.center_latitude, z.center_longitude),
    }))
    .filter(({ zone, distance }) => distance <= zone.radius_miles)
    .sort((a, b) => a.zone.radius_miles - b.zone.radius_miles);

  return matching.length > 0 ? matching[0].zone : null;
}

/**
 * Check if current time is within allowed delivery hours for the zone.
 * Handles overnight windows (e.g. 07:00–02:00 next day).
 */
function timeToMins(t) {
  if (!t) return null;
  const parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function isOvernight(start, end) {
  return start !== null && end !== null && start >= end;
}

// dayIndex: 0=Sun, 1=Mon, ..., 6=Sat
export function getHoursForDay(zone, dayIndex) {
  if (!zone) return { closed: true };
  if (dayIndex === 0) {
    if (zone.sunday_closed) return { closed: true };
    return { closed: false, start: zone.sunday_hours_start, end: zone.sunday_hours_end };
  }
  if (dayIndex === 6) {
    return {
      closed: false,
      start: zone.saturday_hours_start || zone.legal_hours_start,
      end: zone.saturday_hours_end || zone.legal_hours_end,
    };
  }
  return { closed: false, start: zone.legal_hours_start, end: zone.legal_hours_end };
}

/**
 * Check if current time is within allowed delivery hours for the zone.
 * Supports per-day windows: Mon–Fri (legal_hours_*), Saturday (saturday_hours_*),
 * Sunday (sunday_closed / sunday_hours_*). Handles overnight windows (e.g. 07:00–01:00).
 */
export function isWithinZoneHours(zone) {
  if (!zone) return true;
  const now = new Date();
  const day = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const today = getHoursForDay(zone, day);
  if (today.closed) {
    // skip today's window, but still check yesterday's overnight tail below
  } else if (!today.start || !today.end) {
    return true; // no hours configured for today → allow
  } else {
    const s = timeToMins(today.start);
    const e = timeToMins(today.end);
    if (s === null || e === null) return true;
    if (!isOvernight(s, e)) {
      if (nowMins >= s && nowMins < e) return true;
    } else if (nowMins >= s) {
      return true; // evening portion of today's overnight window
    }
  }

  // Early morning: still within yesterday's overnight window?
  if (nowMins < 360) {
    const yesterday = (day + 6) % 7;
    const yest = getHoursForDay(zone, yesterday);
    if (!yest.closed && yest.start && yest.end) {
      const ys = timeToMins(yest.start);
      const ye = timeToMins(yest.end);
      if (ys !== null && ye !== null && isOvernight(ys, ye) && nowMins < ye) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns a human-readable label for today's delivery hours.
 */
export function getTodayHoursLabel(zone) {
  if (!zone) return '';
  const today = getHoursForDay(zone, new Date().getDay());
  if (today.closed) return 'Closed today';
  if (!today.start || !today.end) return `${zone.legal_hours_start || ''} – ${zone.legal_hours_end || ''}`;
  return `${today.start} – ${today.end}`;
}

/**
 * Geocode an address string to lat/lon.
 *
 * Uses Nominatim (OSM) first, with a Photon (komoot) fallback + a single retry.
 * The public Nominatim endpoint rate-limits and intermittently returns empty
 * results, which was causing valid Pine Bluff / Jefferson County addresses to
 * be rejected as "undeliverable" at checkout. The fallback ensures a flaky
 * Nominatim response no longer blocks checkout for addresses in a served zone.
 */
async function geocodeWithNominatim(address, signal) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.length) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
}

async function geocodeWithPhoton(address, signal) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
  if (!res.ok) return null;
  const data = await res.json();
  const feat = data?.features?.[0];
  const coords = feat?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    return { lat: parseFloat(coords[1]), lon: parseFloat(coords[0]) };
  }
  return null;
}

export async function geocodeAddress(address) {
  if (!address) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // 1) Nominatim (primary)
    let result = await geocodeWithNominatim(address, controller.signal).catch(() => null);
    if (result) return result;

    // 2) Photon fallback (different provider, more lenient parser)
    result = await geocodeWithPhoton(address, controller.signal).catch(() => null);
    if (result) return result;

    // 3) One Nominatim retry (transient rate-limit / empty response)
    await new Promise((r) => setTimeout(r, 600));
    result = await geocodeWithNominatim(address, controller.signal).catch(() => null);
    if (result) return result;

    return null;
  } finally {
    clearTimeout(timeout);
  }
}