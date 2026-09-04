// Shared Clover credential resolution and API helpers.
// Used by syncCloverSalesToStripe (read-only status) and fetchCloverOrderReadOnly.

export const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';

/**
 * Resolve Clover API credentials from the StorePosCredential entity (source of truth).
 *
 * Clover operations are ALWAYS merchant-scoped. The shared CLOVER_API_TOKEN /
 * CLOVER_MERCHANT_ID env secrets belong to the platform's own merchant and must
 * NEVER be used for any retailer — doing so would route orders and inventory to
 * the wrong merchant. A store must have its own OAuth token stored in its
 * StorePosCredential record. If no credential token exists, resolution returns
 * tokenSource 'none' (callers surface a re-authorization error) rather than
 * silently falling back to the shared env token.
 *
 * Returns { apiToken, merchantId, tokenSource, cred, envToken, envMerchantId, credToken, credMerchantId, refreshed, refreshError }
 */
export async function resolveCloverCredentials(base44, storeId, options = {}) {
  // `noEnvFallback` is accepted for backward call-site compatibility but is now
  // always effectively true — env fallback has been removed entirely.
  const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: storeId }))[0];
  const envToken = (Deno.env.get('CLOVER_API_TOKEN') || '').trim();
  const envMerchantId = (Deno.env.get('CLOVER_MERCHANT_ID') || '').trim();
  const credToken = (cred?.api_token || '').trim();
  const credMerchantId = (cred?.merchant_id || '').trim();

  let apiToken;
  let merchantId;
  let tokenSource;
  let refreshed = false;
  let refreshError = null;
  if (credToken) {
    apiToken = credToken;
    merchantId = credMerchantId;
    tokenSource = 'credential';

    // Self-heal short-lived Clover v2 access tokens. `api_secret` is retained
    // only as a legacy fallback while existing credential records are migrated.
    const refreshToken = (cred.refresh_token || cred.api_secret || '').trim();
    if (refreshToken && credMerchantId) {
      const sandbox = (cred.environment || Deno.env.get('CLOVER_ENVIRONMENT') || 'production').toLowerCase() === 'sandbox';
      const probeUrl = sandbox
        ? `https://sandbox.dev.clover.com/v3/merchants/${credMerchantId}`
        : `https://api.clover.com/v3/merchants/${credMerchantId}`;
      try {
        const probe = await fetch(probeUrl, { headers: { Authorization: `Bearer ${credToken}` } });
        if (probe.status === 401) {
          const r = await refreshCloverToken(base44, storeId);
          if (r.refreshed) {
            apiToken = r.apiToken;
            refreshed = true;
            // Keep the returned `cred` snapshot consistent for callers that read it directly.
            cred.api_token = r.apiToken;
            cred.refresh_token = r.refreshToken;
          } else {
            refreshError = r.error;
          }
        }
      } catch (_) { /* transient network glitch — proceed with stored token; caller surfaces 401 */ }
    }
  } else {
    // No merchant-scoped credential on file — do NOT fall back to the env token.
    apiToken = '';
    merchantId = credMerchantId;
    tokenSource = 'none';
  }

  return { apiToken, merchantId, tokenSource, cred, envToken, envMerchantId, credToken, credMerchantId, refreshed, refreshError };
}

/**
 * Refresh a store's expired Clover v2 access_token using its stored refresh_token
 * (kept in StorePosCredential.refresh_token). Exchanges the refresh_token for a new
 * access_token + refresh_token pair and persists both. Returns { refreshed,
 * apiToken, refreshToken, error }. On any failure the caller should re-authorize.
 */
export async function refreshCloverToken(base44, storeId) {
  const cred = (await base44.asServiceRole.entities.StorePosCredential.filter({ store_id: storeId }))[0];
  const refreshToken = (cred?.refresh_token || cred?.api_secret || '').trim();
  const appId = (cred?.app_id || '').trim() || (Deno.env.get('CLOVER_APP_ID') || '').trim();

  if (!cred || !refreshToken) {
    return { refreshed: false, apiToken: cred?.api_token || '', refreshToken: '', error: 'No refresh_token on file — re-authorize via OAuth' };
  }
  if (!appId) {
    return { refreshed: false, apiToken: cred.api_token, refreshToken, error: 'No Clover App ID available to refresh' };
  }

  const sandbox = (cred.environment || Deno.env.get('CLOVER_ENVIRONMENT') || 'production').toLowerCase() === 'sandbox';
  const refreshUrl = sandbox
    ? 'https://apisandbox.dev.clover.com/oauth/v2/refresh'
    : 'https://api.clover.com/oauth/v2/refresh';

  try {
    const resp = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken, client_id: appId }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Clover token refresh failed:', resp.status, errText);
      return { refreshed: false, apiToken: cred.api_token, refreshToken, error: `Refresh failed (${resp.status})` };
    }
    const data = await resp.json();
    const newAccess = data.access_token || '';
    const newRefresh = data.refresh_token || refreshToken;
    if (!newAccess) {
      return { refreshed: false, apiToken: cred.api_token, refreshToken, error: 'No access_token in refresh response' };
    }
    await base44.asServiceRole.entities.StorePosCredential.update(cred.id, {
      api_token: newAccess,
      refresh_token: newRefresh,
      ...(cred.refresh_token ? {} : { api_secret: '' }),
    });
    return { refreshed: true, apiToken: newAccess, refreshToken: newRefresh, error: null };
  } catch (e) {
    console.error('Clover token refresh exception:', e);
    return { refreshed: false, apiToken: cred.api_token, refreshToken, error: `Refresh exception: ${e.message}` };
  }
}

/**
 * Auto-discover the correct merchant ID from the token via /merchants/current.
 * Mutates and returns { merchantId, merchantAutoDiscovered }.
 */
export async function autoDiscoverMerchantId(apiToken, merchantId) {
  let resolved = merchantId;
  let discovered = false;

  // First check if the stored merchant ID works
  const storedOk = await (async () => {
    for (const env of ['production', 'sandbox']) {
      const url = env === 'production'
        ? `https://api.clover.com/v3/merchants/${merchantId}`
        : `https://sandbox.dev.clover.com/v3/merchants/${merchantId}`;
      try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}` } });
        if (r.ok) return true;
      } catch (_) { /* try next */ }
    }
    return false;
  })();

  if (!storedOk) {
    for (const env of ['production', 'sandbox']) {
      const url = env === 'production'
        ? 'https://api.clover.com/v3/merchants/current'
        : 'https://sandbox.dev.clover.com/v3/merchants/current';
      try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}` } });
        if (r.ok) {
          const merchant = await r.json();
          if (merchant?.id) {
            resolved = merchant.id;
            discovered = true;
            break;
          }
        }
      } catch (_) { /* try next */ }
    }
  }

  return { merchantId: resolved, merchantAutoDiscovered: discovered };
}

/**
 * Find the active Clover environment (production or sandbox) for the given token + merchant.
 * Returns { baseUrl, activeEnv } or { baseUrl: null, activeEnv: null } if neither works.
 */
export async function findActiveCloverEnvironment(apiToken, merchantId) {
  const endpoints = [
    { name: 'production', baseUrl: `https://api.clover.com/v3/merchants/${merchantId}` },
    { name: 'sandbox', baseUrl: `https://sandbox.dev.clover.com/v3/merchants/${merchantId}` },
  ];

  for (const ep of endpoints) {
    try {
      const testResp = await fetch(`${ep.baseUrl}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      });
      if (testResp.ok) {
        return { baseUrl: ep.baseUrl, activeEnv: ep.name };
      }
    } catch (_) { /* try next */ }
  }

  return { baseUrl: null, activeEnv: null };
}

/**
 * Verify that a token is valid for a SPECIFIC merchant (the store's configured merchant_id),
 * not auto-discovered to some other merchant. Used before pushing orders so we never
 * write an order to the wrong merchant's POS.
 * Returns { ok, httpStatus, merchantName, environment, reason }
 */
export async function assertMerchantScopedToken(apiToken, expectedMerchantId) {
  const endpoints = [
    { name: 'production', url: `https://api.clover.com/v3/merchants/${expectedMerchantId}` },
    { name: 'sandbox', url: `https://sandbox.dev.clover.com/v3/merchants/${expectedMerchantId}` },
  ];

  // Capture the raw Clover response body on failure so diagnostics can surface
  // the exact error without ever exposing the token.
  let lastStatus = null;
  let lastBody = null;
  let lastEnv = null;

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep.url, { headers: { Authorization: `Bearer ${apiToken}` } });
      if (resp.ok) {
        const info = await resp.json();
        return {
          ok: true,
          httpStatus: resp.status,
          merchantName: info?.name || null,
          environment: ep.name,
          reason: 'Token authenticates for the configured merchant',
        };
      }
      // 401/403 = token not valid for this merchant; record and try the other env
      lastStatus = resp.status;
      lastEnv = ep.name;
      try { lastBody = await resp.text(); } catch (_) { lastBody = null; }
    } catch (e) {
      lastStatus = null;
      lastBody = `fetch error: ${e.message}`;
      lastEnv = ep.name;
    }
  }

  // Truncate the body to keep responses compact; never include the token.
  const bodySnippet = lastBody ? String(lastBody).slice(0, 500) : null;

  return {
    ok: false,
    httpStatus: lastStatus,
    merchantName: null,
    environment: lastEnv,
    reason: 'Token does not authenticate for the store\'s configured merchant ID — merchant-specific OAuth not completed (or token expired)',
    request_merchant_id: expectedMerchantId,
    clover_response_status: lastStatus,
    clover_response_body: bodySnippet,
  };
}

/**
 * Read-only verification of a merchant-scoped Clover token. Confirms the token
 * authenticates for the configured merchant, can read inventory + orders, and
 * that the merchant name loosely matches the expected store name. NEVER creates
 * or mutates any data — safe to run after OAuth or manual token entry.
 *
 * is_configured should be set true ONLY when `ok` is true.
 *
 * Returns { ok, merchantName, environment, inventoryRead, inventoryCount,
 *           ordersRead, ordersCount, ordersWrite, nameMatch, permissions, reason }
 */
export async function verifyCloverMerchantAccess(apiToken, merchantId, expectedStoreName) {
  const envs = [
    { name: 'production', base: 'https://api.clover.com/v3/merchants' },
    { name: 'sandbox', base: 'https://sandbox.dev.clover.com/v3/merchants' },
  ];
  const headers = { Authorization: `Bearer ${apiToken}` };

  let merchantName = null;
  let environment = null;
  let merchantOk = false;

  for (const env of envs) {
    try {
      const r = await fetch(`${env.base}/${merchantId}`, { headers });
      if (r.ok) {
        const info = await r.json();
        merchantName = info?.name || null;
        environment = env.name;
        merchantOk = true;
        break;
      }
    } catch (_) { /* try next environment */ }
  }

  if (!merchantOk) {
    return {
      ok: false, merchantName, environment,
      inventoryRead: false, inventoryCount: 0,
      ordersRead: false, ordersCount: 0, ordersWrite: false,
      nameMatch: false, permissions: [],
      reason: 'Token does not authenticate for the configured merchant — re-authorize via OAuth',
    };
  }

  const base = envs.find((e) => e.name === environment).base;

  // Inventory read — first 10 items
  let inventoryRead = false;
  let inventoryCount = 0;
  try {
    const r = await fetch(`${base}/${merchantId}/items?limit=10`, { headers });
    if (r.ok) {
      const d = await r.json();
      inventoryCount = (d?.elements || []).length;
      inventoryRead = true;
    }
  } catch (_) { /* inventory read failed */ }

  // Orders read — recent 5 orders (read-only; NEVER POST — no order is created)
  let ordersRead = false;
  let ordersCount = 0;
  try {
    const r = await fetch(`${base}/${merchantId}/orders?limit=5`, { headers });
    if (r.ok) {
      const d = await r.json();
      ordersCount = (d?.elements || []).length;
      ordersRead = true;
    }
  } catch (_) { /* orders read failed */ }

  // Orders write cannot be safely tested without creating an order (forbidden).
  // The ORDER_W scope is granted at the app level in the Clover Developer
  // Dashboard; read access to /orders confirms the ORDER scope is present on
  // this token, so we infer write capability from read access.
  const ordersWrite = ordersRead;

  // Loose name match: at least one significant token (len>=3) from the store
  // name appears in the Clover merchant name (case-insensitive).
  const storeTokens = (expectedStoreName || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.replace(/[^a-z0-9]/g, '').length >= 3);
  const mLower = (merchantName || '').toLowerCase();
  const nameMatch = storeTokens.length === 0
    ? true
    : storeTokens.some((t) => mLower.includes(t.replace(/[^a-z0-9]/g, '')));

  const permissions = [];
  if (inventoryRead) permissions.push('INVENTORY_R');
  if (ordersRead) permissions.push('ORDER_R');
  if (ordersWrite) permissions.push('ORDER_W (app-scope)');

  const ok = merchantOk && inventoryRead && ordersRead && nameMatch;
  let reason = 'Verified';
  if (!inventoryRead) reason = 'Inventory read failed — token lacks INVENTORY_R scope or merchant has no items';
  else if (!ordersRead) reason = 'Orders read failed — token lacks ORDER scope';
  else if (!nameMatch) reason = `Merchant name "${merchantName}" does not match expected store "${expectedStoreName}"`;

  return {
    ok, merchantName, environment,
    inventoryRead, inventoryCount,
    ordersRead, ordersCount, ordersWrite,
    nameMatch, permissions, reason,
  };
}