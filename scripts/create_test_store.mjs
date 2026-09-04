import fs from 'fs';
import path from 'path';
import { createClient } from '@base44/sdk';

function loadEnv(file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) return {};
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const idx = l.indexOf('=');
    if (idx === -1) continue;
    const key = l.slice(0, idx).trim();
    const val = l.slice(idx+1).trim();
    out[key] = val;
  }
  return out;
}

const env = { ...process.env, ...loadEnv(path.resolve(process.cwd(), '.env.local')) };
const appId = env.VITE_BASE44_APP_ID;
const appBaseUrl = env.VITE_BASE44_APP_BASE_URL;
const apiKey = env.VITE_BASE44_API_KEY;

if (!appId || !appBaseUrl) {
  console.error('Missing VITE_BASE44_APP_ID or VITE_BASE44_APP_BASE_URL in environment or .env.local');
  process.exit(1);
}

const client = createClient({
  appId,
  token: null,
  functionsVersion: undefined,
  serverUrl: appBaseUrl,
  requiresAuth: false,
  appBaseUrl,
  headers: apiKey ? { api_key: apiKey } : {}
});

(async () => {
  try {
    // Choose a test email - update if you need a different account
    const testEmail = env.TEST_RETAILER_EMAIL || 'madhouserecords@yahoo.com';

    const payload = {
      name: `Test Store (Local) ${Date.now()}`,
      license_number: `TEST-${Math.floor(Math.random()*90000)+10000}`,
      address: '123 Test St',
      city: 'Pine Bluff',
      county: 'Jefferson',
      state: 'AR',
      zip_code: '71601',
      phone: '(870) 555-0000',
      email: testEmail,
      onboarding_status: 'contract_sent',
      is_active: true
    };

    console.log('Creating test Store with email =', testEmail);
    const created = await client.entities.Store.create(payload);
    console.log('Created store:', created);
    console.log('\nTo remove this test store, run:');
    console.log(`  node scripts/delete_test_store.mjs ${created.id}`);
  } catch (e) {
    console.error('Failed to create test store:', e?.message || e);
    console.error(e);
    process.exit(2);
  }
})();
