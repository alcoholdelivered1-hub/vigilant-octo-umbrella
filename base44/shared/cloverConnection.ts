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

export async function getCloverClient(base44, storeId) {
  const matches = await base44.asServiceRole.entities.CloverConnection.filter({ store_id: storeId, status: 'connected' });
  const connection = matches[0];
  if (!connection) throw new Error('Beverage King Clover is not connected');

  let accessToken = await decryptToken(connection.encrypted_access_token, connection.access_token_iv);
  const expiresAt = connection.access_token_expires_at ? new Date(connection.access_token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now() + 120000) {
    const refreshToken = await decryptToken(connection.encrypted_refresh_token, connection.refresh_token_iv);
    const response = await fetch('https://api.clover.com/oauth/v2/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: secrets.get('CLOVER_APP_ID'), refresh_token: refreshToken }),
    });
    const refreshed = await response.json();
    if (!response.ok) {
      await base44.asServiceRole.entities.CloverConnection.update(connection.id, { status: 'expired' });
      throw new Error(refreshed.message || 'Beverage King Clover authorization expired');
    }
    const nextAccess = await encryptToken(refreshed.access_token);
    const nextRefresh = await encryptToken(refreshed.refresh_token);
    accessToken = refreshed.access_token;
    await base44.asServiceRole.entities.CloverConnection.update(connection.id, {
      encrypted_access_token: nextAccess.encrypted,
      access_token_iv: nextAccess.iv,
      encrypted_refresh_token: nextRefresh.encrypted,
      refresh_token_iv: nextRefresh.iv,
      access_token_expires_at: new Date(refreshed.access_token_expiration * 1000).toISOString(),
      refresh_token_expires_at: new Date(refreshed.refresh_token_expiration * 1000).toISOString(),
    });
  }

  return {
    merchantId: connection.merchant_id,
    merchantName: connection.merchant_name,
    origin: 'https://api.clover.com',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json' },
  };
}