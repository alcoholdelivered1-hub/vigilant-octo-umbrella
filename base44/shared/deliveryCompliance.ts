/**
 * Server-side delivery compliance verification for Arkansas alcohol delivery.
 *
 * Mirrors the client-side logic in src/lib/zoneUtils.js + distanceUtils.js but
 * runs inside backend functions so zone matching, wet/dry status, legal hours,
 * delivery fees, mileage surcharges, and tax rates are enforced server-side and
 * cannot be bypassed by tampering with client state.
 */

export interface DeliveryZone {
  id?: string;
  name?: string;
  county?: string;
  is_active?: boolean;
  is_wet?: boolean;
  zone_status?: string;
  center_latitude?: number;
  center_longitude?: number;
  radius_miles?: number;
  delivery_fee?: number;
  min_order_amount?: number;
  tax_rate?: number;
  legal_hours_start?: string;
  legal_hours_end?: string;
  saturday_hours_start?: string;
  saturday_hours_end?: string;
  sunday_closed?: boolean;
  sunday_hours_start?: string;
  sunday_hours_end?: string;
}

export interface Store {
  id?: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  compliance_status?: string;
  is_active?: boolean;
}

export interface ComplianceResult {
  approved: boolean;
  zone?: DeliveryZone;
  distanceMiles: number;
  deliveryFee: number;
  mileageSurcharge: number;
  taxRate: number;
  rejectionReason?: string;
  coords?: { lat: number; lon: number };
}

/** Haversine distance in miles between two coordinates. */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** $1.00 per mile over 7 miles (driver keeps the extra). */
export function calculateMileageSurcharge(distance: number): number {
  const threshold = 7;
  if (distance <= threshold) return 0;
  return parseFloat((distance - threshold).toFixed(2));
}

/**
 * Given a lat/lon and a list of DeliveryZone records, returns the matching
 * active wet zone (smallest radius that contains the point), or null.
 */
export function findZoneForLocation(
  lat: number,
  lon: number,
  zones: DeliveryZone[]
): DeliveryZone | null {
  if (!lat || !lon || !zones?.length) return null;

  const matching = zones
    .filter(
      (z) =>
        z.is_active &&
        z.is_wet &&
        (z.zone_status || 'active') === 'active' &&
        z.center_latitude &&
        z.center_longitude &&
        z.radius_miles
    )
    .map((z) => ({
      zone: z,
      distance: calculateDistance(lat, lon, z.center_latitude!, z.center_longitude!),
    }))
    .filter(({ zone, distance }) => distance <= (zone.radius_miles as number))
    .sort((a, b) => (a.zone.radius_miles as number) - (b.zone.radius_miles as number));

  return matching.length > 0 ? matching[0].zone : null;
}

function timeToMins(t: string | undefined): number | null {
  if (!t) return null;
  const parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
}

function isOvernight(start: number, end: number): boolean {
  return start >= end;
}

function getHoursForDay(
  zone: DeliveryZone,
  dayIndex: number
): { closed: boolean; start?: string; end?: string } {
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
 * Supports per-day windows and overnight windows (e.g. 07:00–01:00).
 */
export function isWithinZoneHours(zone: DeliveryZone): boolean {
  if (!zone) return true;
  const now = new Date();
  const day = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const today = getHoursForDay(zone, day);
  if (!today.closed) {
    if (!today.start || !today.end) return true;
    const s = timeToMins(today.start);
    const e = timeToMins(today.end);
    if (s === null || e === null) return true;
    if (!isOvernight(s, e)) {
      if (nowMins >= s && nowMins < e) return true;
    } else if (nowMins >= s) {
      return true;
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
 * Geocode an address string to lat/lon.
 *
 * Nominatim (OSM) is primary, with a Photon (komoot) fallback and a single
 * Nominatim retry. The public Nominatim endpoint rate-limits and intermittently
 * returns empty results, which was causing valid Pine Bluff / Jefferson County
 * addresses to be rejected as undeliverable at checkout. The fallback ensures
 * a flaky Nominatim response no longer blocks checkout for served addresses.
 */
async function geocodeWithNominatim(
  address: string,
  signal: AbortSignal
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      // Nominatim's usage policy requires an identifying User-Agent;
      // without one it returns 403 Access Denied and geocoding fails.
      'User-Agent': 'AlcoholDelivered/1.0 (delivery compliance verification)',
    },
    signal,
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.length) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
}

async function geocodeWithPhoton(
  address: string,
  signal: AbortSignal
): Promise<{ lat: number; lon: number } | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
  if (!res.ok) return null;
  const data = await res.json();
  const coords = data?.features?.[0]?.geometry?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    return { lat: parseFloat(coords[1]), lon: parseFloat(coords[0]) };
  }
  return null;
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lon: number } | null> {
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
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Full server-side delivery compliance check.
 * Geocodes the address, matches an approved wet zone, verifies legal hours and
 * retailer compliance, and returns server-derived fees/tax/distance.
 */
export async function verifyDeliveryCompliance(params: {
  deliveryAddress: string;
  store: Store;
  zones: DeliveryZone[];
}): Promise<ComplianceResult> {
  const { deliveryAddress, store, zones } = params;

  const fail = (reason: string, zone?: DeliveryZone, coords?: { lat: number; lon: number }) => ({
    approved: false,
    zone,
    distanceMiles: 0,
    deliveryFee: 0,
    mileageSurcharge: 0,
    taxRate: 0,
    rejectionReason: reason,
    coords,
  });

  if (!store.compliance_status || store.compliance_status !== 'compliant' || !store.is_active) {
    return fail('Selected retailer is not licensed or approved for delivery.');
  }

  const coords = await geocodeAddress(`${deliveryAddress}, AR`);
  if (!coords) {
    return fail('Invalid or incomplete delivery address — could not be verified.');
  }

  const matched = findZoneForLocation(coords.lat, coords.lon, zones);
  if (!matched) {
    return fail(
      'Delivery is not available at this address. Address is outside all approved service zones.',
      undefined,
      coords
    );
  }
  if (!matched.is_wet) {
    return fail(
      'Address is in a dry jurisdiction — alcohol delivery is not legal here.',
      matched,
      coords
    );
  }
  if (!isWithinZoneHours(matched)) {
    return fail(
      `Deliveries in ${matched.name} are currently outside legal hours.`,
      matched,
      coords
    );
  }

  // Calculate distance from store to delivery address
  let distanceMiles = 0;
  if (store.latitude && store.longitude) {
    distanceMiles = calculateDistance(
      store.latitude,
      store.longitude,
      coords.lat,
      coords.lon
    );
  }

  return {
    approved: true,
    zone: matched,
    distanceMiles,
    deliveryFee: matched.delivery_fee ?? 3.0,
    mileageSurcharge: calculateMileageSurcharge(distanceMiles),
    taxRate: matched.tax_rate ?? 0.065,
    coords,
  };
}