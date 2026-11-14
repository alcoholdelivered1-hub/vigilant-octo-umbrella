import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MapContainer, TileLayer, Circle, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Plus, Pencil, Trash2, CheckCircle2, Clock, Loader2, ToggleLeft, ToggleRight, ExternalLink, Info, ShieldCheck, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GIS_BOUNDARY } from '@/lib/config';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const PINE_BLUFF = [34.2284, -92.0032];
const ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

const EMPTY_FORM = {
  name: '', county: '', is_wet: true, is_active: true,
  center_latitude: '', center_longitude: '', radius_miles: '',
  legal_hours_start: '07:00', legal_hours_end: '01:00',
  saturday_hours_start: '07:00', saturday_hours_end: '00:00',
  sunday_closed: true, sunday_hours_start: '', sunday_hours_end: '',
  delivery_fee: '3.00', min_order_amount: '20.00',
  zone_status: 'active', wet_jurisdiction_verified: false,
  compliance_last_reviewed: '', boundary_version: GIS_BOUNDARY.boundary_version,
  admin_notes: '',
};

function MapClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function ZoneForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleMapPick = (lat, lon) => {
    setForm(p => ({ ...p, center_latitude: lat.toFixed(6), center_longitude: lon.toFixed(6) }));
    toast.success('Center point set from map click');
  };

  const centerPos = form.center_latitude && form.center_longitude
    ? [parseFloat(form.center_latitude), parseFloat(form.center_longitude)]
    : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label>Zone Name *</Label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Pine Bluff Core" />
        </div>
        <div className="space-y-1.5">
          <Label>County *</Label>
          <Input value={form.county} onChange={e => set('county', e.target.value)} placeholder="Jefferson" />
        </div>
        <div className="space-y-1.5">
          <Label>Radius (miles) *</Label>
          <Input type="number" value={form.radius_miles} onChange={e => set('radius_miles', e.target.value)} placeholder="5" min="0.5" step="0.5" />
        </div>
        <div className="space-y-1.5">
          <Label>Delivery Fee ($) *</Label>
          <Input type="number" value={form.delivery_fee} onChange={e => set('delivery_fee', e.target.value)} placeholder="3.00" min="0" step="0.50" />
        </div>
        <div className="space-y-1.5">
          <Label>Min Order ($) *</Label>
          <Input type="number" value={form.min_order_amount} onChange={e => set('min_order_amount', e.target.value)} placeholder="20.00" min="0" step="1" />
        </div>
        <div className="space-y-1.5">
          <Label>Mon–Fri Start</Label>
          <Input type="time" value={form.legal_hours_start} onChange={e => set('legal_hours_start', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Mon–Fri End</Label>
          <Input type="time" value={form.legal_hours_end} onChange={e => set('legal_hours_end', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Sat Start</Label>
          <Input type="time" value={form.saturday_hours_start || ''} onChange={e => set('saturday_hours_start', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Sat End</Label>
          <Input type="time" value={form.saturday_hours_end || ''} onChange={e => set('saturday_hours_end', e.target.value)} />
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.sunday_closed} onChange={e => set('sunday_closed', e.target.checked)} className="w-4 h-4 rounded" />
            Closed Sundays
          </label>
          {!form.sunday_closed && (
            <div className="flex items-center gap-2">
              <Input type="time" value={form.sunday_hours_start || ''} onChange={e => set('sunday_hours_start', e.target.value)} className="w-28" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="time" value={form.sunday_hours_end || ''} onChange={e => set('sunday_hours_end', e.target.value)} className="w-28" />
            </div>
          )}
        </div>
        <div className="col-span-2 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.is_wet} onChange={e => set('is_wet', e.target.checked)} className="w-4 h-4 rounded" />
            Wet zone (alcohol legal)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 rounded" />
            Active
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Zone Status</Label>
          <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={form.zone_status || 'active'} onChange={e => set('zone_status', e.target.value)}>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Wet Jurisdiction Verified (ABC)</Label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={form.wet_jurisdiction_verified || false} onChange={e => set('wet_jurisdiction_verified', e.target.checked)} className="w-4 h-4 rounded" />
            Independently verified
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Compliance Last Reviewed</Label>
          <Input type="date" value={form.compliance_last_reviewed || ''} onChange={e => set('compliance_last_reviewed', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Boundary Version</Label>
          <Input value={form.boundary_version || GIS_BOUNDARY.boundary_version} onChange={e => set('boundary_version', e.target.value)} />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label>Admin Notes</Label>
          <textarea className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={form.admin_notes || ''} onChange={e => set('admin_notes', e.target.value)} placeholder="Internal compliance or boundary notes" />
        </div>
      </div>

      {/* Map picker */}
      <div className="space-y-1.5">
        <Label>Center Point — <span className="text-muted-foreground font-normal">click map to set</span></Label>
        <div className="rounded-xl overflow-hidden border h-52">
          <MapContainer
            center={centerPos || PINE_BLUFF}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <MapClickHandler onPick={handleMapPick} />
            {centerPos && (
              <>
                <Marker position={centerPos} />
                {form.radius_miles && (
                  <Circle
                    center={centerPos}
                    radius={parseFloat(form.radius_miles) * 1609.34}
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15 }}
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>
        {centerPos && (
          <p className="text-xs text-muted-foreground">
            Center: {parseFloat(form.center_latitude).toFixed(4)}, {parseFloat(form.center_longitude).toFixed(4)}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={saving || !form.name || !form.county || !form.radius_miles || !form.center_latitude}
          className="flex-1"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
          Save Zone
        </Button>
      </div>
    </div>
  );
}

export default function ZoneEditor() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | zone object
  const [selectedZone, setSelectedZone] = useState(null);

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones-editor'],
    queryFn: () => base44.entities.DeliveryZone.list('name', 100),
  });

  const saveMutation = useMutation({
    mutationFn: (form) => {
      const payload = {
        ...form,
        center_latitude: parseFloat(form.center_latitude) || null,
        center_longitude: parseFloat(form.center_longitude) || null,
        radius_miles: parseFloat(form.radius_miles) || null,
        delivery_fee: parseFloat(form.delivery_fee) || 3,
        min_order_amount: parseFloat(form.min_order_amount) || 20,
      };
      if (form.id) return base44.entities.DeliveryZone.update(form.id, payload);
      return base44.entities.DeliveryZone.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones-editor'] });
      setEditing(null);
      toast.success('Zone saved!');
    },
    onError: () => toast.error('Failed to save zone'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DeliveryZone.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones-editor'] });
      if (selectedZone?.id === editing?.id) setEditing(null);
      toast.success('Zone deleted');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.DeliveryZone.update(id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones-editor'] }),
  });

  const mapCenter = selectedZone?.center_latitude
    ? [selectedZone.center_latitude, selectedZone.center_longitude]
    : PINE_BLUFF;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <MapPin className="w-7 h-7 text-primary" /> Zone Editor
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Draw delivery zones with custom fees, minimums, and operating hours
          </p>
        </div>
        <Button onClick={() => setEditing('new')} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Zone
        </Button>
      </div>

      {/* Arkansas GIS Boundary Reference */}
      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{GIS_BOUNDARY.source_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dataset last updated: {GIS_BOUNDARY.last_updated} · Version {GIS_BOUNDARY.boundary_version}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <a href={GIS_BOUNDARY.dataset_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-7 text-xs"><ExternalLink className="w-3 h-3 mr-1" />Boundary Dataset</Button>
              </a>
              <a href={GIS_BOUNDARY.check_my_city_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-7 text-xs"><ExternalLink className="w-3 h-3 mr-1" />Check My City</Button>
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-800">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p>Municipal boundary verification and wet/dry eligibility are separate checks. Being inside a city boundary does not automatically approve delivery.</p>
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <p className="font-medium">Humphrey Notice:</p>
          <p className="ml-1">{GIS_BOUNDARY.humphrey_notice}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: zone list */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : zones.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-2xl text-muted-foreground text-sm">
              No zones yet — click <strong>Add Zone</strong> to start
            </div>
          ) : (
            zones.map((zone, i) => {
              const color = ZONE_COLORS[i % ZONE_COLORS.length];
              const isSelected = selectedZone?.id === zone.id;
              return (
                <div
                  key={zone.id}
                  onClick={() => setSelectedZone(isSelected ? null : zone)}
                  className={`bg-card border rounded-2xl p-4 cursor-pointer transition-all space-y-3 ${isSelected ? 'ring-2 ring-primary shadow-sm' : 'hover:shadow-sm hover:border-primary/30'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <p className="font-semibold text-sm">{zone.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {zone.is_wet ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">Wet</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-red-50 border-red-200 text-red-700">Dry</Badge>
                      )}
                      {zone.is_active ? (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                      )}
                      {zone.zone_status && zone.zone_status !== 'active' && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">{zone.zone_status}</Badge>
                      )}
                      {zone.wet_jurisdiction_verified ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">Wet ✓</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">Wet ?</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center bg-muted/50 rounded-lg p-1.5">
                      <p className="font-bold">{zone.radius_miles ?? '—'} mi</p>
                      <p className="text-muted-foreground">radius</p>
                    </div>
                    <div className="text-center bg-muted/50 rounded-lg p-1.5">
                      <p className="font-bold">${(zone.delivery_fee ?? 3).toFixed(2)}</p>
                      <p className="text-muted-foreground">delivery</p>
                    </div>
                    <div className="text-center bg-muted/50 rounded-lg p-1.5">
                      <p className="font-bold">${(zone.min_order_amount ?? 20).toFixed(0)}</p>
                      <p className="text-muted-foreground">min order</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="flex items-center gap-1"><Clock className="w-3 h-3" /> Mon–Fri: {zone.legal_hours_start || '—'} – {zone.legal_hours_end || '—'}</p>
                    <p className="pl-4">Sat: {zone.saturday_hours_start || zone.legal_hours_start || '—'} – {zone.saturday_hours_end || zone.legal_hours_end || '—'} · Sun: {zone.sunday_closed ? 'Closed' : `${zone.sunday_hours_start || '—'}–${zone.sunday_hours_end || '—'}`}</p>
                    <p className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Reviewed: {zone.compliance_last_reviewed || 'Never'}</p>
                    <p className="pl-4">Boundary: {zone.boundary_version || GIS_BOUNDARY.boundary_version}</p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-7 text-xs"
                      onClick={e => { e.stopPropagation(); setEditing(zone); }}
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={e => { e.stopPropagation(); toggleMutation.mutate({ id: zone.id, is_active: !zone.is_active }); }}
                    >
                      {zone.is_active ? <ToggleRight className="w-3.5 h-3.5 text-emerald-500" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); if (confirm('Delete this zone?')) deleteMutation.mutate(zone.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: map + form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Overview map */}
          {!editing && (
            <div className="bg-card border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Delivery Zone Map</p>
                {selectedZone && <Badge variant="outline" className="ml-auto text-xs">{selectedZone.name} selected</Badge>}
              </div>
              <div className="h-[420px]">
                <MapContainer
                  center={mapCenter}
                  zoom={selectedZone ? 11 : 10}
                  key={selectedZone?.id || 'overview'}
                  style={{ width: '100%', height: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  {zones.filter(z => z.center_latitude && z.center_longitude && z.radius_miles).map((zone, i) => {
                    const color = ZONE_COLORS[i % ZONE_COLORS.length];
                    const isSelected = selectedZone?.id === zone.id;
                    return (
                      <Circle
                        key={zone.id}
                        center={[zone.center_latitude, zone.center_longitude]}
                        radius={zone.radius_miles * 1609.34}
                        pathOptions={{
                          color,
                          fillColor: color,
                          fillOpacity: isSelected ? 0.25 : 0.1,
                          weight: isSelected ? 3 : 1.5,
                          dashArray: zone.is_active ? undefined : '6 4',
                        }}
                      />
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          )}

          {/* Zone form */}
          {editing && (
            <div className="bg-card border rounded-2xl p-5">
              <h2 className="font-semibold mb-5">{editing === 'new' ? 'Create New Zone' : `Edit: ${editing.name}`}</h2>
              <ZoneForm
                initial={editing === 'new' ? null : editing}
                onSave={form => saveMutation.mutate(editing === 'new' ? form : { ...form, id: editing.id })}
                onCancel={() => setEditing(null)}
                saving={saveMutation.isPending}
              />
            </div>
          )}

          {/* Legend */}
          {!editing && zones.length > 0 && (
            <div className="bg-card border rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Zone Legend</p>
              <div className="grid grid-cols-2 gap-2">
                {zones.map((zone, i) => (
                  <div key={zone.id} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                    <span className="truncate">{zone.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">${(zone.delivery_fee ?? 3).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}