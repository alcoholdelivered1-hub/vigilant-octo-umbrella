import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, MapPin, ExternalLink, AlertTriangle, Info, ShieldCheck, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GIS_BOUNDARY } from '@/lib/config';

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
};

function isOutdated(dateStr) {
  if (!dateStr) return true;
  const reviewed = new Date(dateStr);
  if (isNaN(reviewed.getTime())) return true;
  const days = (Date.now() - reviewed.getTime()) / (1000 * 60 * 60 * 24);
  return days > 90;
}

function isBoundaryOutdated() {
  const updated = new Date(GIS_BOUNDARY.last_updated);
  if (isNaN(updated.getTime())) return true;
  const days = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return days > 90;
}

export default function AdminZones() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', county: '', center_latitude: '', center_longitude: '', radius_miles: 15,
    legal_hours_start: '07:00', legal_hours_end: '01:00',
    saturday_hours_start: '07:00', saturday_hours_end: '00:00',
    sunday_closed: true, is_wet: true,
    zone_status: 'active', wet_jurisdiction_verified: false,
    compliance_last_reviewed: '', boundary_version: GIS_BOUNDARY.boundary_version,
    admin_notes: '', tax_rate: 0.065,
  });
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
      setForm({
        name: '', county: '', center_latitude: '', center_longitude: '', radius_miles: 15,
        legal_hours_start: '07:00', legal_hours_end: '01:00',
        saturday_hours_start: '07:00', saturday_hours_end: '00:00',
        sunday_closed: true, is_wet: true,
        zone_status: 'active', wet_jurisdiction_verified: false,
        compliance_last_reviewed: '', boundary_version: GIS_BOUNDARY.boundary_version,
        admin_notes: '', tax_rate: 0.065,
      });
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Delivery Zones</h1>
          <p className="text-muted-foreground mt-1">Manage legal delivery areas (wet counties)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Zone</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Delivery Zone</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2"><Label>Zone Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jefferson County" /></div>
              <div className="space-y-2"><Label>County *</Label><Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Center Latitude</Label><Input type="number" step="any" value={form.center_latitude} onChange={(e) => setForm({ ...form, center_latitude: e.target.value })} /></div>
                <div className="space-y-2"><Label>Center Longitude</Label><Input type="number" step="any" value={form.center_longitude} onChange={(e) => setForm({ ...form, center_longitude: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Radius (miles)</Label><Input type="number" value={form.radius_miles} onChange={(e) => setForm({ ...form, radius_miles: parseFloat(e.target.value) })} /></div>
                <div className="space-y-2"><Label>Tax Rate (e.g. 0.0975)</Label><Input type="number" step="0.001" min="0" max="1" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: parseFloat(e.target.value) })} /><p className="text-xs text-muted-foreground">AR state 6.5% + local. 0.0975 = 9.75%</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Legal Hours Start</Label><Input type="time" value={form.legal_hours_start} onChange={(e) => setForm({ ...form, legal_hours_start: e.target.value })} /></div>
                <div className="space-y-2"><Label>Legal Hours End</Label><Input type="time" value={form.legal_hours_end} onChange={(e) => setForm({ ...form, legal_hours_end: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Wet County (Alcohol Sales Legal)</Label>
                <Switch checked={form.is_wet} onCheckedChange={(val) => setForm({ ...form, is_wet: val })} />
              </div>
              <div className="space-y-2">
                <Label>Zone Status</Label>
                <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.zone_status} onChange={(e) => setForm({ ...form, zone_status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Wet Jurisdiction Verified (ABC)</Label>
                <Switch checked={form.wet_jurisdiction_verified} onCheckedChange={(val) => setForm({ ...form, wet_jurisdiction_verified: val })} />
              </div>
              <div className="space-y-2"><Label>Compliance Last Reviewed</Label><Input type="date" value={form.compliance_last_reviewed} onChange={(e) => setForm({ ...form, compliance_last_reviewed: e.target.value })} /></div>
              <div className="space-y-2"><Label>Boundary Version</Label><Input value={form.boundary_version} onChange={(e) => setForm({ ...form, boundary_version: e.target.value })} /></div>
              <div className="space-y-2"><Label>Admin Notes</Label><Textarea value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })} placeholder="Internal notes about this zone's compliance or boundary status" /></div>
              <Button onClick={() => { if (!form.name || !form.county) { toast.error('Fill required fields'); return; } createMutation.mutate(form); }} className="w-full" disabled={createMutation.isPending}>Add Zone</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Arkansas GIS Boundary Reference */}
      <div className="bg-card rounded-2xl border p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="font-semibold text-sm">Arkansas GIS Municipal Boundaries — Official Reference</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Source: <span className="font-medium">{GIS_BOUNDARY.source_name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Boundary dataset last updated: <span className="font-medium">{GIS_BOUNDARY.last_updated}</span> (version {GIS_BOUNDARY.boundary_version})
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={GIS_BOUNDARY.dataset_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-7 text-xs"><ExternalLink className="w-3 h-3 mr-1" />Municipal Boundaries Dataset</Button>
              </a>
              <a href={GIS_BOUNDARY.check_my_city_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-7 text-xs"><ExternalLink className="w-3 h-3 mr-1" />Check My City</Button>
              </a>
            </div>
          </div>
        </div>
        {isBoundaryOutdated() && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>The Arkansas GIS boundary dataset may be outdated (last updated {GIS_BOUNDARY.last_updated}). Please verify against the latest data before making eligibility decisions.</p>
          </div>
        )}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p><span className="font-semibold">Important:</span> Municipal boundary verification and alcohol wet/dry eligibility are separate checks. Being inside a city boundary does not automatically approve an address for delivery.</p>
        </div>
      </div>

      {/* Humphrey Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Internal Notice — Humphrey Ward Correction</p>
          <p className="text-xs mt-1 text-amber-800">{GIS_BOUNDARY.humphrey_notice}</p>
        </div>
      </div>

      {/* Zone Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">Loading...</p>
        ) : zones.length === 0 ? (
          <p className="col-span-full text-center py-12 text-muted-foreground">No zones configured</p>
        ) : (
          zones.map(zone => (
            <div key={zone.id} className="bg-card rounded-2xl border p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{zone.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{zone.county} County</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Badge variant="outline" className={zone.is_wet ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'}>
                    {zone.is_wet ? 'Wet' : 'Dry'}
                  </Badge>
                  <Badge variant="outline" className={STATUS_STYLES[zone.zone_status || (zone.is_active ? 'active' : 'suspended')] || STATUS_STYLES.active}>
                    {(zone.zone_status || (zone.is_active ? 'active' : 'suspended')).charAt(0).toUpperCase() + (zone.zone_status || (zone.is_active ? 'active' : 'suspended')).slice(1)}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {zone.radius_miles && <p>Radius: {zone.radius_miles} miles</p>}
                <p>Tax Rate: {((zone.tax_rate ?? 0.065) * 100).toFixed(2)}%</p>
                <p>Mon–Fri: {zone.legal_hours_start} – {zone.legal_hours_end}</p>
                <p>Sat: {zone.saturday_hours_start || zone.legal_hours_start} – {zone.saturday_hours_end || zone.legal_hours_end}</p>
                <p>Sun: {zone.sunday_closed ? 'Closed' : `${zone.sunday_hours_start || ''} – ${zone.sunday_hours_end || ''}`}</p>
              </div>
              <div className="space-y-1.5 pt-2 border-t">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                  <span className="text-muted-foreground">Wet Verified:</span>
                  <Badge variant="outline" className={zone.wet_jurisdiction_verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}>
                    {zone.wet_jurisdiction_verified ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span className="text-muted-foreground">Reviewed:</span>
                  <span className={isOutdated(zone.compliance_last_reviewed) ? 'text-amber-600 font-medium' : ''}>
                    {zone.compliance_last_reviewed || 'Never'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Boundary: {zone.boundary_version || GIS_BOUNDARY.boundary_version}</p>
              </div>
              {isOutdated(zone.compliance_last_reviewed) && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3" />
                  Compliance review may be outdated
                </div>
              )}
              {zone.admin_notes && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 italic">{zone.admin_notes}</p>
              )}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch
                  checked={zone.is_active}
                  onCheckedChange={(val) => updateMutation.mutate({ id: zone.id, data: { is_active: val, zone_status: val ? 'active' : 'suspended' } })}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}