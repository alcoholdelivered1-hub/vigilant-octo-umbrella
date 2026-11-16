import { useState } from 'react';

export function authReturnTo() {
  const value = new URLSearchParams(window.location.search).get('returnTo') || '/';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && !['/login', '/register', '/forgot-password', '/reset-password'].includes(url.pathname) ? url.pathname + url.search + url.hash : '/';
  } catch { return '/'; }
}

export default function useAuthForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async task => {
    if (busy) return;
    setBusy(true); setError('');
    try { await task(); }
    catch (error) { setError(error?.response?.data?.message || error?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  return { busy, error, run };
}