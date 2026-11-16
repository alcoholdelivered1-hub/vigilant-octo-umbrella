import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function AdminZones() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', county: '', center_latitude: '', center_longitude: '', radius_miles: 15, legal_hours_start: '07:00', legal_hours_end: '02:00', is_wet: true });
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['admin-zones'],
    queryFn: () => base44.entities.DeliveryZone.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DeliveryZone.create({
      ...data,
      center_latitude: data.center_latitude ? parseFloat(data.center_latitude) : undefined,
      center_longitude: data.center_longitude ? parseFloat(data.center_longitude) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
      setOpen(false);
      setForm({ name: '', county: '', center_latitude: '', center_longitude: '', radius_miles: 15, legal_hours_start: '07:00', legal_hours_end: '02:00', is_wet: true });
      toast.success('Zone added');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DeliveryZone.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-zones'] });
      toast.success('Zone updated');
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Delivery Zones</h1>
          <p className="text-muted-foreground mt-1">Manage legal delivery areas (wet counties)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Zone</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Delivery Zone</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2"><Label>Zone Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jefferson County" /></div>
              <div className="space-y-2"><Label>County *</Label><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Center Latitude</Label><Input type="number" step="any" value={form.center_latitude} onChange={(e) => setForm({ ...form, center_latitude: e.target.value })} /></div>
                <div className="space-y-2"><Label>Center Longitude</Label><Input type="number" step="any" value={form.center_longitude} onChange={(e) => setForm({ ...form, center_longitude: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Radius (miles)</Label><Input type="number" value={form.radius_miles} onChange={(e) => setForm({ ...form, radius_miles: parseFloat(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Legal Hours Start</Label><Input type="time" value={form.legal_hours_start} onChange={(e) => setForm({ ...form, legal_hours_start: e.target.value })} /></div>
                <div className="space-y-2"><Label>Legal Hours End</Label><Input type="time" value={form.legal_hours_end} onChange={(e) => setForm({ ...form, legal_hours_end: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Wet County (Alcohol Sales Legal)</Label>
                <Switch checked={form.is_wet} onCheckedChange={(val) => setForm({ ...form, is_wet: val })} />
              </div>
              <Button onClick={() => { if (!form.name || !form.county) { toast.error('Fill required fields'); return; } createMutation.mutate(form); }} className="w-full" disabled={createMutation.isPending}>Add Zone</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">Loading...</p>
        ) : zones.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">No zones configured</p>
        ) : (
          zones.map(zone => (
            <div key={zone.id} className="bg-card rounded-2xl border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{zone.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{zone.county} County</p>
                </div>
                <Badge variant="outline" className={zone.is_wet ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}>
                  {zone.is_wet ? 'Wet' : 'Dry'}
                </Badge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                {zone.radius_miles && <p>Radius: {zone.radius_miles} miles</p>}
                {zone.legal_hours_start && <p>Legal Hours: {zone.legal_hours_start} – {zone.legal_hours_end}</p>}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  checked={zone.is_active}
                  onCheckedChange={(val) => updateMutation.mutate({ id: zone.id, data: { is_active: val } })}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}