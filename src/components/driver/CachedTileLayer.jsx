import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getTile, setTile } from '@/lib/tileCache';

/**
 * Custom Leaflet tile layer that checks IndexedDB cache before
 * hitting the network. Cached tiles are served instantly offline.
 * Uncached tiles are fetched, stored for next time, then displayed.
 */
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords, done) {
    const img = document.createElement('img');
    const url = this.getTileUrl(coords);

    (async () => {
      // 1. Check IndexedDB cache
      const cached = await getTile(url);
      if (cached) {
        const blobUrl = URL.createObjectURL(cached);
        img._blobUrl = blobUrl;
        img.onload = () => done(null, img);
        img.onerror = () => done(new Error('blob error'), img);
        img.src = blobUrl;
        return;
      }

      // 2. Not cached — fetch, store, and display
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        await setTile(url, blob);
        const blobUrl = URL.createObjectURL(blob);
        img._blobUrl = blobUrl;
        img.onload = () => done(null, img);
        img.onerror = () => done(new Error('blob error'), img);
        img.src = blobUrl;
        return;
      } catch {
        // 3. Fetch failed — fall back to direct img load if online
        if (navigator.onLine) {
          img.onload = () => done(null, img);
          img.onerror = () => done(new Error('tile error'), img);
          img.src = url;
        } else {
          // Offline & uncached — gray placeholder so map stays usable
          img.style.backgroundColor = '#e5e7eb';
          done(null, img);
        }
      }
    })();

    return img;
  },
});

export default function CachedTileLayerComponent({
  url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution = '&copy; OpenStreetMap contributors',
  maxZoom = 19,
}) {
  const map = useMap();

  useEffect(() => {
    const layer = new CachedTileLayer(url, {
      attribution,
      maxZoom,
    });
    layer.addTo(map);

    // Revoke blob URLs on tile unload to prevent memory leaks
    const handleUnload = (e) => {
      if (e.tile && e.tile._blobUrl) {
        URL.revokeObjectURL(e.tile._blobUrl);
      }
    };
    layer.on('tileunload', handleUnload);

    return () => {
      layer.off('tileunload', handleUnload);
      map.removeLayer(layer);
    };
  }, [map, url, attribution, maxZoom]);

  return null;
}