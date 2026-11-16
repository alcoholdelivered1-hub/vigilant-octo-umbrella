import { useEffect, useState } from 'react';

// Phones, tablets and installed/native builds run the app shell;
// desktop browsers run the website.
const APP_SHELL_QUERY = '(max-width: 1023px), (display-mode: standalone)';

export function isAppShellDevice() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(APP_SHELL_QUERY).matches;
}

export function useAppShell() {
  const [appShell, setAppShell] = useState(isAppShellDevice);

  useEffect(() => {
    const query = window.matchMedia(APP_SHELL_QUERY);
    const sync = () => setAppShell(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return appShell;
}