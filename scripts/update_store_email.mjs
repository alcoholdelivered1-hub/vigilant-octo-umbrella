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
    const newEmail = process.argv[2];
    const searchTerm = process.argv[3] || env.TEST_RETAILER_EMAIL || 'madhouserecords@yahoo.com';
    if (!newEmail) {
      console.error('Usage: node scripts/update_store_email.mjs <newEmail> [searchTerm]');
      process.exit(1);
    }

    console.log('Finding store by name containing "Test Store" or matching', searchTerm);
    const stores = await client.entities.Store.list('name', 500);
    const matched = stores.find(s => (s.name && s.name.toLowerCase().includes('test store')) || (s.email && s.email.toLowerCase() === searchTerm.toLowerCase()));
    if (!matched) {
      console.error('No matching store found. Consider passing a store id as searchTerm.');
      process.exit(2);
    }

    console.log('Found store:', matched.id, matched.name, 'current email:', matched.email);
    const updated = await client.entities.Store.update(matched.id, { email: newEmail });
    console.log('Updated store:', updated.id, 'new email:', updated.email);
    process.exit(0);
  } catch (e) {
    console.error('Failed to update store email:', e?.response?.data || e?.message || e);
    process.exit(3);
  }
})();
