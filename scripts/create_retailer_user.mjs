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
    const email = process.argv[2] || env.TEST_RETAILER_EMAIL || 'madhouserecords@yahoo.com';
    const password = process.argv[3] || env.TEST_RETAILER_PASSWORD || `TestStore!${Math.floor(Math.random()*9000)+1000}`;

    console.log('Registering user:', email);
    const res = await client.auth.register({ email, password });
    console.log('Registration response:', res);

    if (res?.access_token) {
      console.log('User registered and authenticated. Access token issued. You can log in with the credentials now.');
    } else {
      console.log('Registration likely created an unverified account. Check email for verification code or use the password reset flow to sign in.');
    }

    console.log('\nCredentials:');
    console.log('  Email: ', email);
    console.log('  Password:', password);
    process.exit(0);
  } catch (e) {
    console.error('Registration failed:', e?.response?.data || e?.message || e);
    process.exit(2);
  }
})();
