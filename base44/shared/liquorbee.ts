import { secrets } from 'base44:runtime';

// LiquorBee Partner API client: config, token cache, request helper and product mapper.
// The client secret and bearer token are never logged or returned to a caller.

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 20000;

function readSecret(name) {
  try {
    const value = secrets.get(name);
    return typeof value === 'string' ? value.trim() : '';
  } catch (error) {
    return '';
  }
}

export function getLiquorBeeConfig() {
  const rawBaseUrl = readSecret('LIQUORBEE_BASE_URL').replace(/\/+$/, '');
  // Accept a bare host in the secret (e.g. "api.example.com") by assuming https.
  const baseUrl = rawBaseUrl && !/^https?:\/\//i.test(rawBaseUrl) ? `https://${rawBaseUrl}` : rawBaseUrl;
  const clientId = readSecret('LIQUORBEE_CLIENT_ID') || 'bottlecapps';
  const clientSecret = readSecret('LIQUORBEE_PARTNER_CLIENT_SECRET') || readSecret('LIQUORBEE_CLIENT_SECRET');
  const missing = [];
  if (!baseUrl) missing.push('LIQUORBEE_BASE_URL');
  if (!clientId) missing.push('LIQUORBEE_CLIENT_ID');
  if (!clientSecret) missing.push('LIQUORBEE_CLIENT_SECRET');
  if (missing.length > 0) {
    return { ok: false, error: `LiquorBee not configured: ${missing.join(', ')}` };
  }
  return { ok: true, config: { baseUrl, clientId, clientSecret } };
}

let tokenCache = null;

function scopeFor(config) {
  return `${config.baseUrl}|${config.clientId}`;
}

function readField(source, ...names) {
  if (!source || typeof source !== 'object') return undefined;
  for (const name of names) {
    const value = source[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  const lowered = {};
  for (const [key, value] of Object.entries(source)) lowered[key.toLowerCase()] = value;
  for (const name of names) {
    const value = lowered[name.toLowerCase()];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

export { readField };

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(typeof value === 'string' ? value.replace(/[^0-9.\-]/g, '') : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function messageFrom(data) {
  if (!data) return null;
  if (typeof data === 'string') return data.slice(0, 500);
  const message = readField(data, 'failureReason', 'FailureReason', 'error', 'message', 'title', 'detail');
  if (typeof message === 'string') return message.slice(0, 500);
  if (message && typeof message === 'object') return messageFrom(message);
  return null;
}

async function readBody(response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function tokenFrom(data) {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();
  const direct = readField(data, 'token', 'accessToken', 'access_token', 'Token', 'bearerToken');
  if (typeof direct === 'string') return direct.trim();
  const nested = readField(data, 'data', 'result', 'auth');
  if (nested && typeof nested === 'object') return tokenFrom(nested);
  return '';
}

async function login(config) {
  let response;
  try {
    response = await fetch(`${config.baseUrl}/api/partner/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ clientId: config.clientId, clientSecret: config.clientSecret }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, status: 0, data: null, error: `LiquorBee network error during login: ${error.message}` };
  }

  const data = await readBody(response);
  const token = tokenFrom(data);
  if (!response.ok || !token) {
    return {
      ok: false,
      status: response.status || 502,
      data,
      error: messageFrom(data) || `LiquorBee login failed (${response.status})`,
    };
  }

  tokenCache = {
    token,
    scope: scopeFor(config),
    expiresAt: Date.now() + TOKEN_LIFETIME_MS - TOKEN_REFRESH_MARGIN_MS,
  };
  return { ok: true, token };
}

function cachedToken(config) {
  if (!tokenCache) return null;
  if (tokenCache.scope !== scopeFor(config)) return null;
  if (tokenCache.expiresAt <= Date.now()) return null;
  return tokenCache.token;
}

async function send(config, { path, method, query, merchantId, body, token }) {
  const url = new URL(`${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (merchantId) headers['X-Merchant-Id'] = String(merchantId);

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await readBody(response);
    return { ok: response.ok, status: response.status, data, error: response.ok ? null : messageFrom(data) };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: `LiquorBee network error: ${error.message}` };
  }
}

async function authorizedSend(config, options) {
  let token = cachedToken(config);
  if (!token) {
    const result = await login(config);
    if (!result.ok) return result;
    token = result.token;
  }
  return send(config, { ...options, token });
}

function toResult(result) {
  return {
    ok: Boolean(result.ok),
    status: result.status || 0,
    data: result.data === undefined ? null : result.data,
    error: result.error ? String(result.error).slice(0, 500) : null,
  };
}

// One call against the Partner API. On 401 the token is refreshed once and the call retried a single time.
export async function liquorbeeCall(config, options) {
  const { auth = true, method = 'GET', query, merchantId, body, path } = options;
  if (!auth) return toResult(await send(config, { path, method, query, merchantId, body }));

  const first = await authorizedSend(config, { path, method, query, merchantId, body });
  if (first.status !== 401) return toResult(first);

  tokenCache = null;
  const retried = await authorizedSend(config, { path, method, query, merchantId, body });
  if (retried.status === 401) tokenCache = null;
  return toResult(retried);
}

export function extractProducts(data) {
  const container = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  const list = Array.isArray(data)
    ? data
    : [container.items, container.products, container.results, container.data, container.Items, container.value]
        .find((candidate) => Array.isArray(candidate));

  const pagination = {};
  const sources = [
    ['page', ['page', 'Page', 'currentPage']],
    ['pageSize', ['pageSize', 'PageSize', 'perPage', 'PerPage']],
    ['totalCount', ['totalCount', 'TotalCount', 'total', 'Total']],
    ['hasMore', ['hasMore', 'HasMore', 'hasNextPage', 'HasNextPage']],
  ];
  for (const [key, names] of sources) {
    const value = readField(container, ...names);
    if (value !== undefined && value !== null) pagination[key] = value;
  }
  const raw = readField(container, 'pagination', 'Pagination', 'paging');
  if (raw && typeof raw === 'object') pagination.raw = raw;

  return { items: Array.isArray(list) ? list : [], pagination };
}

const CATEGORY_HINTS = [
  { category: 'beer', words: ['beer', 'ale', 'lager', 'stout', 'porter', 'ipa', 'pilsner', 'cider', 'seltzer'] },
  { category: 'wine', words: ['wine', 'chardonnay', 'cabernet', 'merlot', 'pinot', 'rosé', 'rose', 'sauvignon', 'riesling', 'moscato', 'prosecco', 'champagne', 'zinfandel', 'chianti'] },
  { category: 'mixers', words: ['mixer', 'soda', 'tonic', 'juice', 'cola', 'ginger', 'syrup', 'grenadine', 'bitters'] },
  { category: 'spirits', words: ['vodka', 'whiskey', 'whisky', 'bourbon', 'rum', 'tequila', 'gin', 'brandy', 'cognac', 'liqueur', 'scotch', 'mezcal', 'spirit', 'liquor', 'schnapps', 'vermouth', 'triple sec'] },
  { category: 'accessories', words: ['glass', 'cooler', 'opener', 'accessor', 'coaster', 'shaker', 'ice bag'] },
];

// LiquorBee only sends MISC, LIQUOR, WINE and MIXER. Anything unmapped is stored as
// "other" rather than dropped, so a retailer's full catalog always syncs.
function mapCategory(item, name) {
  const explicit = readField(item, 'category', 'Category', 'department', 'Department', 'type', 'Type');
  const text = `${explicit === undefined ? '' : explicit} ${name}`.toLowerCase();
  for (const hint of CATEGORY_HINTS) {
    if (hint.words.some((word) => text.includes(word))) return hint.category;
  }
  return 'other';
}

export function mapLiquorBeeProduct(item, storeId) {
  if (!item || typeof item !== 'object') {
    return { record: null, error: 'Empty product record from LiquorBee' };
  }

  const externalId = readField(item, 'itemId', 'ItemId', 'id', 'Id');
  if (externalId === undefined || String(externalId).trim() === '') {
    return { record: null, error: 'Product without an ItemId' };
  }

  const price = toNumber(readField(item, 'sellingPrice', 'SellingPrice', 'price', 'Price', 'retailPrice', 'RetailPrice'));
  if (price === undefined) {
    return { record: null, error: `Product ${externalId} has no selling price` };
  }

  // LiquorBee returns the display name in productName; productDescription is the fallback.
  const name = String(
    readField(item, 'productName', 'ProductName', 'productDescription', 'ProductDescription') || ''
  ).trim();

  const available = toNumber(
    readField(item, 'availableQuantity', 'AvailableQuantity', 'quantityAvailable', 'QuantityAvailable', 'onHand', 'OnHand', 'quantity', 'Quantity')
  );

  const record = {
    external_id: String(externalId).trim(),
    store_id: storeId,
    inventory_source: 'liquor_bee',
    name: name || `Item ${externalId}`,
    price,
    in_stock: available === undefined ? true : available > 0,
    last_synced_at: new Date().toISOString(),
  };

  if (available !== undefined) record.stock_quantity = available;

  const sku = readField(item, 'sku', 'Sku', 'skuNumber', 'SkuNumber');
  if (sku) record.sku = String(sku);
  const upc = readField(item, 'upc', 'Upc', 'UPC', 'barcode', 'Barcode');
  if (upc) record.upc = String(upc);
  const brand = readField(item, 'brand', 'Brand', 'brandName', 'BrandName');
  if (brand) record.brand = String(brand);

  const category = mapCategory(item, record.name);
  if (category) record.category = category;

  const volume = readField(item, 'volume', 'Volume', 'size', 'Size', 'containerSize', 'ContainerSize');
  if (volume) record.volume = String(volume);
  const abv = toNumber(readField(item, 'abv', 'Abv', 'ABV', 'alcoholByVolume', 'AlcoholByVolume'));
  if (abv !== undefined) record.abv = abv;

  const description = readField(item, 'description', 'Description', 'longDescription', 'LongDescription');
  if (description && String(description) !== record.name) record.description = String(description).slice(0, 2000);

  const image = readField(item, 'imageUrl', 'ImageUrl', 'image', 'Image', 'imageURL');
  if (image && /^https?:\/\//i.test(String(image))) record.image_url = String(image);

  return { record, error: null };
}

const STATUS_LABELS = { 0: 'Closed', 1: 'Open', 2: 'Ready' };

export function normalizeStatusLabel(value) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (/^\d+$/.test(text)) return STATUS_LABELS[text] || null;
  const lowered = text.toLowerCase();
  if (lowered === 'open') return 'Open';
  if (lowered === 'ready') return 'Ready';
  if (lowered === 'closed') return 'Closed';
  return null;
}