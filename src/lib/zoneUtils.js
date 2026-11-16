import { calculateDistance } from './distanceUtils';

/**
 * Given a lat/lon and a list of DeliveryZone records,
 * returns the matching active zone (smallest radius that contains the point),
 * or null if no zone matches.
 */
export function findZoneForLocation(lat, lon, zones) {
  if (!lat || !lon || !zones?.length) return null;

  const matching = zones
    .filter(z => z.is_active && z.center_latitude && z.center_longitude && z.radius_miles)
    .map(z => ({
      zone: z,
      distance: calculateDistance(lat, lon, z.center_latitude, z.center_longitude),
    }))
    .filter(({ zone, distance }) => distance <= zone.radius_miles)
    .sort((a, b) => a.zone.radius_miles - b.zone.radius_miles);

  // A specifically configured dry zone always blocks delivery, even if it overlaps
  // a larger wet county/radius zone.
  if (matching.some(({ zone }) => zone.is_wet === false)) return null;

  const wetMatching = matching.filter(({ zone }) => zone.is_wet === true);
  return wetMatching.length > 0 ? wetMatching[0].zone : null;
}

/**
 * Check if current time is within allowed delivery hours for the zone.
 * Handles overnight windows (e.g. 07:00–02:00 next day).
 */
export function isWithinZoneHours(zone) {
  if (!zone?.legal_hours_start || !zone?.legal_hours_end) return true;
  const now = new Date();
  const [startH, startM] = zone.legal_hours_start.split(':').map(Number);
  const [endH, endM] = zone.legal_hours_end.split(':').map(Number);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const nowMins = Number(parts.find(part => part.type === 'hour').value) * 60 + Number(parts.find(part => part.type === 'minute').value);
  const startMins = startH * 60 + startM;
  const endMins = endH * 60 + endM;
  if (startMins <= endMins) {
    return nowMins >= startMins && nowMins <= endMins;
  }
  // Overnight window (e.g. 07:00–02:00)
  return nowMins >= startMins || nowMins <= endMins;
}

/**
 * Geocode an address string to lat/lon using Nominatim (free, no key needed).
 */
export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (data?.length) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  }
  return null;
}