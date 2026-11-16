import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, Loader2, CheckCircle2, Store } from 'lucide-react';
import { toast } from 'sonner';
import CloverConnectionCard from '@/components/partner/CloverConnectionCard';
import CloverOnlinePaymentsPanel from '@/components/partner/CloverOnlinePaymentsPanel';

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
    phone: '',
    email: '',
    notification_phone: '',
  });

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
        phone: store.phone || '',
        email: store.email || '',
        notification_phone: store.notification_phone || '',
      });
    }
  }, [store]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result } = await base44.functions.invoke('retailerSetup', { action:'get',store_id:storeId });
      if (!result.is_admin) throw new Error('Submit business and operating-hours changes in Retailer Setup for review.');
      return base44.entities.Store.update(storeId,data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-detail', storeId] });
      queryClient.invalidateQueries({ queryKey: ['partner-stores'] });
      toast.success('Store settings saved!');
    },
    onError: error => toast.error(error.message || 'Failed to save settings.'),
  });

  const handleSave = () => saveMutation.mutate(form);

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
      <p className="rounded-xl border p-4 text-sm">Retailer changes require review before replacing approved store data. <a className="text-primary underline" href={`/onboarding?store_id=${encodeURIComponent(storeId)}`}>Edit and submit in Retailer Setup</a>.</p>

      {storeId === '6a32d14d09b760f592dbf19e' && <CloverConnectionCard storeId={storeId} storeName={store.name} />}
      <CloverOnlinePaymentsPanel storeId={storeId} />

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

      {/* Hours */}
      <div className="bg-card border rounded-2xl p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Operating Hours
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Opening Time</label>
            <Input
              type="time"
              value={form.operating_hours_start}
              onChange={e => setForm(f => ({ ...f, operating_hours_start: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Closing Time</label>
            <Input
              type="time"
              value={form.operating_hours_end}
              onChange={e => setForm(f => ({ ...f, operating_hours_end: e.target.value }))}
            />
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
    </div>
  );
}