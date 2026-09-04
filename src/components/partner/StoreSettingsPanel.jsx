import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Loader2, CheckCircle2, Store, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeAddress } from '@/lib/zoneUtils';
import StorePayoutSettings from '@/components/partner/StorePayoutSettings';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function StoreSettingsPanel({ storeId }) {
  const queryClient = useQueryClient();

  const { data: store, isLoading } = useQuery({
    queryKey: ['store-detail', storeId],
    queryFn: () => base44.entities.Store.filter({ id: storeId }, 'name', 1).then(r => r[0]),
    enabled: !!storeId,
  });

  const [form, setForm] = useState({
    operating_hours_start: '',
    operating_hours_end: '',
    saturday_hours_start: '',
    saturday_hours_end: '',
    phone: '',
    email: '',
    notification_phone: '',
  });
  const [gpsLoading, setGpsLoading] = useState(false);

  // Track which delivery zone this store belongs to
  const { data: zones = [] } = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: () => base44.entities.DeliveryZone.list('name', 50),
  });

  useEffect(() => {
    if (store) {
      setForm({
        operating_hours_start: store.operating_hours_start || '',
        operating_hours_end: store.operating_hours_end || '',
        saturday_hours_start: store.saturday_hours_start || '',
        saturday_hours_end: store.saturday_hours_end || '',
        phone: store.phone || '',
        email: store.email || '',
        notification_phone: store.notification_phone || '',
      });
    }
  }, [store]);

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Store.update(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-detail', storeId] });
      queryClient.invalidateQueries({ queryKey: ['partner-stores'] });
      toast.success('Store settings saved!');
    },
    onError: () => toast.error('Failed to save settings.'),
  });

  const handleSave = () => saveMutation.mutate(form);

  // Re-geocode the store pin from the full street address (Nominatim/Photon)
  const handleRegeocode = async () => {
    if (!store) return;
    setGpsLoading(true);
    try {
      const coords = await geocodeAddress(`${store.address}, ${store.city}, ${store.state}`);
      if (!coords) {
        toast.error('Could not find GPS coordinates for this address. Try editing the address first.');
        return;
      }
      await base44.entities.Store.update(storeId, {
        latitude: coords.lat,
        longitude: coords.lon,
      });
      queryClient.invalidateQueries({ queryKey: ['store-detail', storeId] });
      toast.success('Store location updated from address.');
    } catch (e) {
      toast.error('Failed to update location.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Pin the store to the device's current GPS reading (browser geolocation)
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported on this device.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await base44.entities.Store.update(storeId, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          queryClient.invalidateQueries({ queryKey: ['store-detail', storeId] });
          toast.success('Store location set to your current GPS position.');
        } catch (e) {
          toast.error('Failed to save location.');
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsLoading(false);
        toast.error('Location access denied. Enable location permissions to use this.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading store info…
    </div>
  );

  if (!store) return (
    <div className="text-center py-20 text-muted-foreground">
      <Store className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>Store not found.</p>
    </div>
  );

  // Find store's zone by county match
  const storeZone = zones.find(z => z.county?.toLowerCase() === store.county?.toLowerCase());

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Store Info (read-only) */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Store className="w-4 h-4 text-primary" /> Store Info
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Store Name</p>
            <p className="font-medium">{store.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">License #</p>
            <p className="font-medium">{store.license_number || '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground mb-0.5">Address</p>
            <p className="font-medium">{store.address}, {store.city}, {store.state}</p>
          </div>
        </div>
      </div>

      {/* Store GPS Location */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Store GPS Location
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Latitude</p>
            <p className="font-medium font-mono">{store.latitude?.toFixed(6) || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Longitude</p>
            <p className="font-medium font-mono">{store.longitude?.toFixed(6) || '—'}</p>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border bg-muted h-44 mb-3">
          <MapContainer
            center={[store.latitude || 34.7465, store.longitude || -92.2896]}
            zoom={store.latitude ? 14 : 8}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {store.latitude && store.longitude && (
              <Marker position={[store.latitude, store.longitude]} />
            )}
          </MapContainer>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleRegeocode} disabled={gpsLoading} variant="outline" className="flex-1 gap-2">
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            Re-geocode from Address
          </Button>
          <Button onClick={handleUseCurrentLocation} disabled={gpsLoading} variant="outline" className="flex-1 gap-2">
            {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
            Use My Current GPS
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg px-3 py-2">
          Accurate coordinates keep deliveries, distance fees, and the customer tracking map correct. Re-geocode after any address change.
        </p>
      </div>

      {/* Hours */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Operating Hours
        </h3>
        <div className="space-y-4">
          {/* Mon–Fri */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Monday – Friday</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Opening</label>
                <Input
                  type="time"
                  value={form.operating_hours_start}
                  onChange={e => setForm(f => ({ ...f, operating_hours_start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Closing</label>
                <Input
                  type="time"
                  value={form.operating_hours_end}
                  onChange={e => setForm(f => ({ ...f, operating_hours_end: e.target.value }))}
                />
              </div>
            </div>
          </div>
          {/* Saturday */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Saturday</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Opening</label>
                <Input
                  type="time"
                  value={form.saturday_hours_start}
                  onChange={e => setForm(f => ({ ...f, saturday_hours_start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Closing</label>
                <Input
                  type="time"
                  value={form.saturday_hours_end}
                  onChange={e => setForm(f => ({ ...f, saturday_hours_end: e.target.value }))}
                />
              </div>
            </div>
          </div>
          {/* Sunday — always closed */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Sunday</p>
            <div className="bg-muted/50 rounded-lg px-3 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Closed — no deliveries on Sunday per state law.
            </div>
          </div>
        </div>
        {storeZone && (
          <p className="text-xs text-muted-foreground mt-2.5 bg-muted/50 rounded-lg px-3 py-2">
            ⚖️ Legal delivery hours in {storeZone.county} County:&nbsp;
            <strong>{storeZone.legal_hours_start || '—'} – {storeZone.legal_hours_end || '—'}</strong>
            &nbsp;· Deliveries outside these hours are blocked automatically.
          </p>
        )}
      </div>

      {/* Delivery zone info (read-only — admin controls this) */}
      {storeZone && (
        <div className="bg-card border rounded-2xl p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Delivery Zone
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Zone Name</p>
              <p className="font-medium">{storeZone.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Delivery Radius</p>
              <p className="font-medium">{storeZone.radius_miles ? `${storeZone.radius_miles} miles` : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Delivery Fee</p>
              <p className="font-medium">${(storeZone.delivery_fee || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Min Order</p>
              <p className="font-medium">${(storeZone.min_order_amount || 0).toFixed(2)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg px-3 py-2">
            Delivery zone boundaries are managed by the platform administrator. Contact support to request changes.
          </p>
        </div>
      )}

      {/* Contact */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3">Contact & Notifications</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Store Phone</label>
            <Input
              type="tel"
              placeholder="(870) 555-0100"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Order Notification Email</label>
            <Input
              type="email"
              placeholder="orders@yourstore.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">SMS Notification Phone (optional)</label>
            <Input
              type="tel"
              placeholder="(870) 555-0101"
              value={form.notification_phone}
              onChange={e => setForm(f => ({ ...f, notification_phone: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="w-full sm:w-auto"
      >
        {saveMutation.isPending
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
          : <><CheckCircle2 className="w-4 h-4 mr-2" />Save Changes</>
        }
      </Button>

      {/* Stripe Express Payout Account */}
      <StorePayoutSettings storeId={storeId} />
    </div>
  );
}