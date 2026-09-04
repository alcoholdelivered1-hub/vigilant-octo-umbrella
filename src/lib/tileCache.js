/**
 * IndexedDB-based tile cache for offline map support.
 * Stores map tiles as blobs keyed by their URL so drivers
 * can still see the map when cellular signal drops.
 */

const DB_NAME = 'ad-tile-cache';
const STORE = 'tiles';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getTile(url) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(url);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setTile(url, blob) {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, url);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

const SUBDOMAINS = ['a', 'b', 'c'];

function tileUrl(x, y, z) {
  const s = SUBDOMAINS[Math.abs(x + y) % SUBDOMAINS.length];
  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const tileLatRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(tileLatRad) + 1 / Math.cos(tileLatRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * Prefetch all OSM tiles within the given lat/lng bounds
 * for zoom levels minZoom..maxZoom (inclusive).
 * Calls onProgress(done, total) as tiles complete.
 */
export async function prefetchBounds(south, west, north, east, minZoom, maxZoom, onProgress) {
  const tiles = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const tl = latLngToTile(north, west, z);
    const br = latLngToTile(south, east, z);
    const minX = Math.min(tl.x, br.x);
    const maxX = Math.max(tl.x, br.x);
    const minY = Math.min(tl.y, br.y);
    const maxY = Math.max(tl.y, br.y);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ url: tileUrl(x, y, z) });
      }
    }
  }

  let done = 0;
  const CONCURRENT = 6;
  let idx = 0;

  async function worker() {
    while (idx < tiles.length) {
      const { url } = tiles[idx++];
      const cached = await getTile(url);
      if (!cached) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            const blob = await res.blob();
            await setTile(url, blob);
          }
        } catch {
          /* skip failed tile */
        }
      }
      done++;
      if (onProgress) onProgress(done, tiles.length);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENT }, () => worker()));
  return tiles.length;
}

export async function getCacheStats() {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve({ count: req.result });
      req.onerror = () => resolve({ count: 0 });
    });
  } catch {
    return { count: 0 };
  }
}

export async function clearTileCache() {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}