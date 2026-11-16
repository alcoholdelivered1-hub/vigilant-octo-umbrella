import React from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function coordinate(value, limit) {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

export default function RetailerLocation({ store }) {
  const latitude = coordinate(store.latitude, 90);
  const longitude = coordinate(store.longitude, 180);
  const hasPin = latitude !== null && longitude !== null && (latitude !== 0 || longitude !== 0);
  const address = [store.address, store.city, store.state, store.zip_code].filter(Boolean).join(', ');
  const target = hasPin ? [latitude, longitude].join(',') : store.address?.trim() && address;

  return (
    <section aria-label="Retailer location" className="space-y-2 rounded-xl border bg-card p-4">
      <h3 className="font-semibold">Retailer location</h3>
      <p className="text-sm">{address || 'Address unavailable'}{store.county && <span className="block">County: {store.county}</span>}</p>
      {hasPin ? <>
        <MapContainer key={target} center={[latitude, longitude]} zoom={16} scrollWheelZoom={false} className="z-0 h-56 w-full rounded-md">
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          <CircleMarker center={[latitude, longitude]} radius={8} fillOpacity={0.85}><Tooltip>{store.name}</Tooltip></CircleMarker>
        </MapContainer>
        <p className="text-sm text-muted-foreground">Saved coordinates: {latitude}, {longitude}</p>
      </> : <p className="text-sm text-muted-foreground">A map pin requires saved retailer coordinates.</p>}
      {target && <a className="inline-block font-medium underline" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(target)} target="_blank" rel="noopener noreferrer">{hasPin ? 'Open pin in Google Maps' : 'Find address in Google Maps'}</a>}
    </section>
  );
}
