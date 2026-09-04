import { useState, useEffect } from 'react';
import { Download, Trash2, Loader2, WifiOff, CheckCircle2 } from 'lucide-react';
import { prefetchBounds, getCacheStats, clearTileCache } from '@/lib/tileCache';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/**
 * Lets drivers pre-download map tiles for their route area so
 * the map keeps working when signal drops in rural areas.
 * Pass allPoints = array of [lat, lng] for driver + all stops.
 */
export default function OfflineCacheButton({ routePoints = [] }) {
  const [count, setCount] = useState(0);
  const [caching, setCaching] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    getCacheStats().then((s) => setCount(s.count));
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const handleCache = async () => {
    if (!routePoints || routePoints.length === 0) {
      toast.error('No route points to cache yet.');
      return;
    }
    setCaching(true);
    setProgress({ done: 0, total: 0 });
    try {
      const lats = routePoints.map((p) => p[0]);
      const lngs = routePoints.map((p) => p[1]);
      const pad = 0.015; // ~1 mile buffer around route
      const south = Math.min(...lats) - pad;
      const north = Math.max(...lats) + pad;
      const west = Math.min(...lngs) - pad;
      const east = Math.max(...lngs) + pad;

      const total = await prefetchBounds(south, west, north, east, 12, 16, (done, total) => {
        setProgress({ done, total });
      });

      const stats = await getCacheStats();
      setCount(stats.count);
      toast.success(`Cached ${total} map tiles for offline use.`);
    } catch {
      toast.error('Failed to cache map tiles. Check your connection.');
    } finally {
      setCaching(false);
    }
  };

  const handleClear = async () => {
    await clearTileCache();
    setCount(0);
    toast.success('Offline map cache cleared.');
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!online && (
        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
          <WifiOff className="w-3.5 h-3.5" /> Offline
        </span>
      )}
      {count > 0 && !caching && (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> {count} cached
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCache}
        disabled={caching || !online}
        className="text-xs h-8"
      >
        {caching ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {progress.total > 0 ? `${progress.done}/${progress.total}` : 'Caching…'}
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" /> Cache Offline
          </>
        )}
      </Button>
      {count > 0 && !caching && (
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs h-8 px-2">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}