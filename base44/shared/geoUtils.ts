/**
 * Shared geo helpers for backend functions.
 * Plain module — import from backend functions, no Deno.serve.
 */

export const PINE_BLUFF_LAT = 34.2284;
export const PINE_BLUFF_LON = -92.0032;

/** Great-circle distance in miles between two lat/lon points (Haversine). */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Geocode an address via OpenStreetMap Nominatim (free, no API key). Returns {lat, lon} or null. */
export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AlcoholDelivered/1.0 (alcohol.delivered1@gmail.com)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}