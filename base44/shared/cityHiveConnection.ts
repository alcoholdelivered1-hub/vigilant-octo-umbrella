import { secrets } from 'base44:runtime';

function bytesToBase64(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(secrets.get('CLOVER_TOKEN_ENCRYPTION_KEY')),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptToken(value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(value));
  return { encrypted: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

export async function decryptToken(encrypted, iv) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    await encryptionKey(),
    base64ToBytes(encrypted),
  );
  return new TextDecoder().decode(decrypted);
}

export async function getCityHiveConnection(base44, storeId) {
  const matches = await base44.asServiceRole.entities.CityHiveConnection.filter({ store_id: storeId, status: 'connected' });
  const connection = matches[0];
  if (!connection) throw new Error('CityHive is not connected for this store');
  const apiToken = await decryptToken(connection.encrypted_api_token, connection.api_token_iv);
  return { connection, apiToken };
}

// CityHive API base URL
const API_BASE = 'https://api.cityhive.net';

// CityHive category mapping
function mapCategory(chCategory) {
  const c = String(chCategory || '').toLowerCase();
  if (c.includes('beer')) return 'beer';
  if (c.includes('wine') || c.includes('champagne')) return 'wine';
  if (c.includes('spirit') || c.includes('liquor') || c.includes('whiskey') || c.includes('vodka') || c.includes('rum') || c.includes('tequila') || c.includes('gin') || c.includes('bourbon')) return 'spirits';
  if (c.includes('mixer') || c.includes('soda') || c.includes('juice')) return 'mixers';
  return 'spirits';
}

/**
 * Fetch products from the CityHive merchant API.
 * Tries multiple common endpoint patterns since the API is not publicly documented.
 */
export async function fetchCityHiveProducts(apiToken) {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  // Try common endpoint patterns
  const endpoints = [
    `${API_BASE}/api/merchant/products`,
    `${API_BASE}/api/products`,
    `${API_BASE}/api/v1/merchant/products`,
    `${API_BASE}/api/v1/products`,
  ];

  let lastError = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const text = await res.text();
      if (!res.ok) {
        lastError = new Error(`CityHive API ${res.status}: ${text.slice(0, 500)}`);
        console.log(`[CityHive] ${url} → ${res.status}`);
        continue;
      }
      const data = JSON.parse(text);
      console.log(`[CityHive] ${url} → success, keys: ${Object.keys(data).join(', ')}`);
      // Handle various response shapes
      const products = Array.isArray(data) ? data
        : Array.isArray(data.products) ? data.products
        : Array.isArray(data.data) ? data.data
        : Array.isArray(data.items) ? data.items
        : Array.isArray(data.results) ? data.results
        : null;
      if (products) return products;
      lastError = new Error(`CityHive API returned unexpected format: ${JSON.stringify(data).slice(0, 500)}`);
    } catch (e) {
      console.log(`[CityHive] ${url} → error: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError || new Error('Could not reach the CityHive API. Verify your API token and try again.');
}

/**
 * Map a CityHive product to our Product entity fields.
 */
export function mapCityHiveProduct(item, storeId) {
  const name = item.name || item.title || item.product_name || 'Unknown Product';
  const price = Number(item.price ?? item.regular_price ?? item.unit_price ?? item.retail_price ?? 0);
  const category = mapCategory(item.category || item.type || item.product_type);
  const externalId = String(item.id ?? item._id ?? item.product_id ?? item.sku ?? '');
  const sku = item.sku || item.item_sku || '';
  const upc = item.upc || item.barcode || item.ean || '';
  const stockQty = item.stock_quantity ?? item.inventory ?? item.quantity ?? item.qty ?? null;
  const inStock = item.in_stock ?? item.is_active ?? item.active ?? (stockQty === null ? true : stockQty > 0);
  const brand = item.brand || item.manufacturer || item.vendor || '';
  const volume = item.volume || item.size || item.package_size || '';
  const abv = Number(item.abv ?? item.alcohol_by_volume ?? item.alcohol_percent) || null;
  const image = item.image_url || item.image || item.photo_url || (Array.isArray(item.images) ? item.images[0] : null) || '';

  return {
    name,
    category,
    price,
    store_id: storeId,
    external_id: externalId,
    sku,
    upc,
    brand: brand || undefined,
    volume: volume || undefined,
    abv: abv || undefined,
    image_url: image || undefined,
    in_stock: Boolean(inStock),
    stock_quantity: stockQty !== null ? Number(stockQty) : undefined,
    inventory_source: 'cityhive',
    last_synced_at: new Date().toISOString(),
  };
}