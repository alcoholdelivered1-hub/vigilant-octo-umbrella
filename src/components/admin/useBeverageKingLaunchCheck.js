import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function useBeverageKingLaunchCheck() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState('');
  const pending = useRef(null);
  const run = useCallback(() => {
    if (pending.current) return pending.current;
    const task = (async () => {
      setLoading(true); setError(''); setLastChecked('Check started…');
      let timer;
      try {
        const response = await Promise.race([
          base44.functions.invoke('beverageKingGoLive', { action: 'check' }),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The launch check took longer than 45 seconds. Please try again.')), 45000); }),
        ]);
        if (response.data?.error) throw new Error(response.data.error);
        setResult(response.data);
        setLastChecked(`Last checked ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
      } catch (issue) {
        setError(issue.response?.data?.error || issue.message || 'Launch check failed.');
        setResult(null); setLastChecked('Check failed');
      } finally { clearTimeout(timer); setLoading(false); }
    })();
    pending.current = task;
    task.finally(() => { pending.current = null; });
    return task;
  }, []);
  useEffect(() => {
    run();
    const visible = () => { if (document.visibilityState === 'visible') run(); };
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [run]);
  useEffect(() => {
    if (!result || result.ready || error) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') run(); }, 60000);
    return () => clearInterval(timer);
  }, [result?.ready, error, run]);
  return { result, loading, error, lastChecked, run };
}