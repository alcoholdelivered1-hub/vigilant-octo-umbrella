import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ShieldCheck, MapPin, TrendingUp, Mail, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import StripeOnboardingHub from '@/components/admin/StripeOnboardingHub';
import StoreTemplateLink from '@/components/onboarding/StoreTemplateLink';
import RetailerChatButton from '@/components/messaging/RetailerChatButton';
import RetailerEmailDialog from '@/components/messaging/RetailerEmailDialog';
import RetailerEmailAlerts from '@/components/messaging/RetailerEmailAlerts';
import RetailerEmailAttentionButton from '@/components/messaging/RetailerEmailAttentionButton';
import useRetailerEmailAttention from '@/components/messaging/useRetailerEmailAttention';
import useRetailerOnboardingAttention from '@/components/admin/useRetailerOnboardingAttention';
import RetailerOnboardingAttentionButton from '@/components/admin/RetailerOnboardingAttentionButton';
import EmployerBackgroundCheckPanel from '@/components/admin/EmployerBackgroundCheckPanel';

const TIERS = [
  { value: 'premium', label: '★ Premium — $150/mo', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'featured', label: '◆ Featured — $50/mo', color: 'text-primary bg-primary/10 border-primary/20' },
  { value: 'standard', label: 'Standard — Free', color: 'text-muted-foreground bg-muted border-border' },
];

export default function AdminStores() {
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [emailSelection, setEmailSelection] = useState(null);
  const emailAttention = useRetailerEmailAttention();
  const onboardingAttention = useRetailerOnboardingAttention();

  const handleDownloadContract = async (store) => {
    setDownloadingId(store.id);
    try {
      const { appId, token, functionsVersion, appBaseUrl } = (await import('@/lib/app-params')).appParams;
      const baseUrl = appBaseUrl || '';
      const ver = functionsVersion || 'v1';
      const url = `${baseUrl}/api/apps/${appId}/functions/${ver}/generateRetailerContract`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ store_id: store.id }),
      });
      if (!response.ok) throw new Error('Failed to generate contract');
      const blob = await response.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `RetailerContract_${store.name.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(objUrl);
      toast.success(`Contract downloaded for ${store.name}`);
    } catch (err) {
      toast.error('Failed to generate contract');
    } finally {
      setDownloadingId(null);
    }
  };
  const [form, setForm] = useState({ name: '', license_number: '', address: '', city: '', county: '', zip_code: '', phone: '', email: '', operating_hours_start: '07:00', operating_hours_end: '01:00', saturday_hours_start: '07:00', saturday_hours_end: '00:00', sunday_closed: true });
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['admin-stores-list'],
    queryFn: () => base44.entities.Store.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Store.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores-list'] });
      setOpen(false);
      setForm({ name: '', license_number: '', address: '', city: '', county: '', zip_code: '', phone: '', email: '', operating_hours_start: '07:00', operating_hours_end: '22:00' });
      toast.success('Store added');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Store.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-stores-list'] });
      toast.success('Store updated');
    },
  });

  const handleCreate = () => {
    if (!form.name || !form.license_number || !form.address || !form.city || !form.county) {
      toast.error('Please fill required fields');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Licensed Stores</h1>
          <p className="text-muted-foreground mt-1">Manage partnered retailers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Store</Button></DialogTrigger>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Licensed Retailer</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2"><Label>Store Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>ABC License # *</Label><Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
              <div className="space-y-2"><Label>Address *</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>City *</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>County *</Label><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>ZIP Code</Label><Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Notification Email ✉️</Label><Input type="email" placeholder="orders@yourstore.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Mon–Fri Hours</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Open</Label><Input type="time" value={form.operating_hours_start} onChange={(e) => setForm({ ...form, operating_hours_start: e.target.value })} /></div>
                <div className="space-y-2"><Label>Close</Label><Input type="time" value={form.operating_hours_end} onChange={(e) => setForm({ ...form, operating_hours_end: e.target.value })} /></div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Saturday Hours</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Open</Label><Input type="time" value={form.saturday_hours_start} onChange={(e) => setForm({ ...form, saturday_hours_start: e.target.value })} /></div>
                <div className="space-y-2"><Label>Close</Label><Input type="time" value={form.saturday_hours_end} onChange={(e) => setForm({ ...form, saturday_hours_end: e.target.value })} /></div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input type="checkbox" id="sunday_closed" checked={form.sunday_closed} onChange={(e) => setForm({ ...form, sunday_closed: e.target.checked })} className="w-4 h-4" />
                <Label htmlFor="sunday_closed">Closed on Sundays</Label>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>Add Store</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex flex-wrap gap-2"><Button asChild><Link to="/admin/retailer-onboarding">Retailer Partner Dashboard</Link></Button><Button asChild variant="outline"><Link to="/admin/retailer-contacts">Retailer Contact Directory</Link></Button></div>
      <RetailerEmailAlerts onOpen={setEmailSelection} />
      {onboardingAttention.isLoading && <p className="text-sm text-muted-foreground mb-4">Checking onboarding submissions…</p>}
      {onboardingAttention.error && <div role="alert" className="mb-4 text-sm text-destructive">Could not check onboarding review alerts. <Button size="sm" variant="outline" onClick={() => onboardingAttention.refetch()}>Retry</Button></div>}
      {emailSelection && <RetailerEmailDialog key={`${emailSelection.storeId}:${emailSelection.threadId || ''}`} selection={emailSelection} onClose={() => setEmailSelection(null)} onRead={emailAttention.markRead} />}
      <StripeOnboardingHub />

      {/* Placement Revenue Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {TIERS.map(t => {
          const count = stores.filter(s => (s.placement_tier || 'standard') === t.value).length;
          const revenue = t.value === 'premium' ? count * 150 : t.value === 'featured' ? count * 50 : 0;
          return (
            <div key={t.value} className={`rounded-xl border p-4 ${t.color}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{t.value}</p>
              <p className="text-2xl font-bold mt-1">{count} <span className="text-sm font-normal">stores</span></p>
              {revenue > 0 && <p className="text-xs mt-1 font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3" />${revenue}/mo revenue</p>}
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">Loading...</p>
        ) : stores.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">No stores yet</p>
        ) : (
          stores.map(store => (
            <div key={store.id} className="bg-card rounded-2xl border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{store.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    License: {store.license_number}
                  </div>
                </div>
                <Switch
                  checked={store.is_active}
                  onCheckedChange={(val) => updateMutation.mutate({ id: store.id, data: { is_active: val } })}
                />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <MapPin className="w-3 h-3" />{store.address}, {store.city}, {store.county} Co.
              </div>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p>Mon–Fri: {store.operating_hours_start || '07:00'} – {store.operating_hours_end || '01:00'}</p>
                <p>Saturday: {store.saturday_hours_start || '07:00'} – {store.saturday_hours_end || '00:00'}</p>
                <p>Sunday: {store.sunday_closed !== false ? '🔴 Closed' : `${store.sunday_hours_start} – ${store.sunday_hours_end}`}</p>
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1"><Mail className="w-3 h-3" /> Notification Email</p>
                <Input
                  type="email"
                  className="h-7 text-xs"
                  placeholder="orders@store.com"
                  defaultValue={store.email || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (store.email || '')) {
                      updateMutation.mutate({ id: store.id, data: { email: e.target.value } });
                    }
                  }}
                />
              </div>
              <StoreTemplateLink store={store} />
              <div className="mt-3 pt-3 border-t flex flex-wrap justify-end gap-2">
                <RetailerEmailAttentionButton store={store} pending={emailAttention.pending} onOpen={setEmailSelection} />
                <RetailerChatButton storeId={store.id} storeName={store.name} admin />
                <RetailerOnboardingAttentionButton store={store} attention={onboardingAttention} />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs h-7"
                  disabled={downloadingId === store.id}
                  onClick={() => handleDownloadContract(store)}
                >
                  <FileDown className="w-3 h-3" />
                  {downloadingId === store.id ? 'Generating…' : 'Download Contract'}
                </Button>
                <EmployerBackgroundCheckPanel store={store} />
              </div>
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">Placement Tier</p>
                <Select
                  value={store.placement_tier || 'standard'}
                  onValueChange={(val) => updateMutation.mutate({ id: store.id, data: { placement_tier: val } })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">★ Premium — $150/mo</SelectItem>
                    <SelectItem value="featured">◆ Featured — $50/mo</SelectItem>
                    <SelectItem value="standard">Standard — Free</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}