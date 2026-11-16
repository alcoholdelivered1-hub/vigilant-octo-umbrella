import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function StoreMapResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const resize = () => map.invalidateSize({ pan: false });
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const frame = requestAnimationFrame(resize);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);
  return null;
}