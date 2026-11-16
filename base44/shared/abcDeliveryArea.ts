// ABC's published map uses Arkansas GIS wet/dry polygons, not delivery radii.
const boundaryService = 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Boundaries/FeatureServer';
const countyName = value => String(value || '').replace(/\s+county$/i, '').trim().toLowerCase();

async function queryLayer(layer, parameters) {
  const response = await fetch(`${boundaryService}/${layer}/query`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ f: 'json', resultRecordCount: '100', ...parameters }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('The official ABC delivery map is unavailable. Delivery eligibility could not be confirmed.');
  const data = await response.json();
  if (data.error || data.exceededTransferLimit || !Array.isArray(data.features)) throw new Error('The official ABC delivery map could not confirm this location.');
  return data.features;
}

function pointParameters(lat, lon) {
  if (![lat, lon].every(Number.isFinite) || lat < 33 || lat > 36.6 || lon < -95 || lon > -89) throw new Error('Verified Arkansas pickup and delivery coordinates are required.');
  return { geometry: JSON.stringify({ x: lon, y: lat }), geometryType: 'esriGeometryPoint', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects' };
}

export async function verifyABCDeliveryArea(store, latitude, longitude) {
  if (!store || (store.state && !['AR', 'ARKANSAS'].includes(store.state.toUpperCase()))) throw new Error('An Arkansas retailer is required.');
  const pickup = pointParameters(store.latitude, store.longitude);
  const destination = pointParameters(latitude, longitude);
  const [pickupWet, deliveryWet, pickupCounty, deliveryCounty] = await Promise.all([
    queryLayer(60, { ...pickup, outFields: 'county,type,name', returnGeometry: 'false' }),
    queryLayer(60, { ...destination, outFields: 'county,type,name', returnGeometry: 'false' }),
    queryLayer(48, { ...pickup, outFields: 'county', returnGeometry: 'true' }),
    queryLayer(48, { ...destination, outFields: 'county', returnGeometry: 'false' }),
  ]);
  if (pickupCounty.length !== 1 || deliveryCounty.length !== 1) throw new Error('This location is outside Arkansas or on an unresolved county boundary.');
  const from = pickupCounty[0].attributes.county;
  const to = deliveryCounty[0].attributes.county;
  if (!countyName(store.county) || countyName(from) !== countyName(store.county)) throw new Error('The retailer pickup coordinates do not match its recorded county. Administrator review is required.');
  const wetOnly = (features, county) => features.length > 0 && features.every(feature => feature.attributes.type === 'Wet' && countyName(feature.attributes.county) === countyName(county));
  if (!wetOnly(pickupWet, from)) throw new Error('The official ABC map does not confirm this retailer pickup location as wet territory.');
  if (!wetOnly(deliveryWet, to)) throw new Error('Alcohol delivery is not available in dry, damp or unverified territory at this address.');
  if (countyName(from) !== countyName(to)) {
    const geometry = pickupCounty[0].geometry;
    if (!geometry?.rings) throw new Error('The retailer county boundary could not be verified.');
    const adjoining = await queryLayer(48, { geometry: JSON.stringify(geometry), geometryType: 'esriGeometryPolygon', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'county', returnGeometry: 'false' });
    if (!adjoining.some(feature => countyName(feature.attributes.county) === countyName(to))) throw new Error('Alcohol delivery is limited to the retailer county or an adjoining county, within eligible wet territory.');
  }
  return { pickup_county: from, delivery_county: to, source: `${boundaryService}/60`, checked_at: new Date().toISOString() };
}

export async function geocodeDeliveryAddress(address) {
  if (typeof address !== 'string' || address.trim().length < 8 || address.length > 400) throw new Error('Enter a full delivery street address, city and ZIP code.');
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: `${address.trim()}, Arkansas, USA`, format: 'json', limit: '1', countrycodes: 'us', addressdetails: '1' })}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'AlcoholDelivered/1.0' }, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Address verification is temporarily unavailable. Please try again.');
  const results = await response.json();
  if (!Array.isArray(results) || !results.length) throw new Error('We could not verify the delivery address. Check the street, city and ZIP code.');
  const latitude = Number(results[0].lat), longitude = Number(results[0].lon);
  pointParameters(latitude, longitude);
  const details = results[0].address || {};
  const city = details.city || details.town || details.village || details.hamlet || '';
  return { latitude, longitude, city };
}