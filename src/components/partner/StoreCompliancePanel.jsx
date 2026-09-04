import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { differenceInDays, parseISO } from 'date-fns';
import {
  CheckCircle2, XCircle, AlertTriangle, FileText, Loader2, Save, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const EXPIRY_WARN_DAYS = 30;

function getLicenseStatus(store) {
  const issues = [];
  if (!store.license_number?.trim()) issues.push({ type: 'error', label: 'Missing license number' });
  if (!store.email?.trim())          issues.push({ type: 'error', label: 'No contact email on file' });
  if (!store.phone?.trim())          issues.push({ type: 'warning', label: 'No phone number on file' });
  if (!store.address?.trim())        issues.push({ type: 'error', label: 'Missing physical address' });
  if (!store.county?.trim())         issues.push({ type: 'error', label: 'County not assigned (required for zone compliance)' });
  if (!store.latitude || !store.longitude) issues.push({ type: 'warning', label: 'GPS coordinates missing (affects delivery routing)' });
  if (!store.operating_hours_start || !store.operating_hours_end) issues.push({ type: 'warning', label: 'Operating hours not set' });

  if (store.placement_tier !== 'standard' && store.placement_expires) {
    try {
      const daysLeft = differenceInDays(parseISO(store.placement_expires), new Date());
      if (daysLeft < 0) issues.push({ type: 'error', label: `Paid placement expired ${Math.abs(daysLeft)} days ago` });
      else if (daysLeft <= EXPIRY_WARN_DAYS) issues.push({ type: 'warning', label: `Placement expires in ${daysLeft} days` });
    } catch {}
  }

  const hasErrors = issues.some(i => i.type === 'error');
  const hasWarnings = issues.some(i => i.type === 'warning');
  return { issues, status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok' };
}

const STATUS_CONFIG = {
  error:   { label: 'Action Required', bg: 'bg-red-50',     border: 'border-red-300',   text: 'text-red-700',     icon: XCircle,       iconColor: 'text-red-500' },
  warning: { label: 'Needs Review',    bg: 'bg-amber-50',   border: 'border-amber-300', text: 'text-amber-700',   icon: AlertTriangle, iconColor: 'text-amber-500' },
  ok:      { label: 'Compliant',       bg: 'bg-emerald-50', border: 'border-emerald-300',text: 'text-emerald-700', icon: CheckCircle2,  iconColor: 'text-emerald-500' },
};

export default function StoreCompliancePanel({ storeId }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  const { data: store, isLoading } = useQuery({
    queryKey: ['store-detail', storeId],
    queryFn: () => base44.entities.Store.filter({ id: storeId }, 'name', 1).then(r => r[0]),
    enabled: !!storeId,
    onSuccess: (s) => { if (s && !form) setForm(extractForm(s)); },
  });

  function extractForm(s) {
    return {
      license_number: s.license_number || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      city: s.city || '',
      county: s.county || '',
      zip_code: s.zip_code || '',
      operating_hours_start: s.operating_hours_start || '',
      operating_hours_end: s.operating_hours_end || '',
    };
  }

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.Store.update(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-detail', storeId] });
      setEditing(false);
      toast.success('License information updated');
    },
    onError: () => toast.error('Failed to save changes'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading compliance data…
    </div>
  );

  if (!store) return (
    <div className="text-center py-16 text-muted-foreground">Store not found.</div>
  );

  const currentForm = form || extractForm(store);
  const audit = getLicenseStatus(store);
  const cfg = STATUS_CONFIG[audit.status];
  const Icon = cfg.icon;

  const handleSave = () => mutation.mutate(currentForm);

  const field = (label, key, placeholder = '', type = 'text') => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="text-xs font-medium">{label}</Label>
      <Input
        id={key}
        type={type}
        value={currentForm[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        disabled={!editing}
        className={!editing ? 'bg-muted/40' : ''}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`rounded-2xl border-2 p-5 flex items-start gap-4 ${cfg.bg} ${cfg.border}`}>
        <Icon className={`w-8 h-8 flex-shrink-0 mt-0.5 ${cfg.iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-lg ${cfg.text}`}>{cfg.label}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{store.name}</p>
          {audit.issues.length === 0 ? (
            <p className="text-sm text-emerald-700 mt-2">All license and contact fields are complete. You are in good standing.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {audit.issues.map((issue, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm font-medium ${issue.type === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                  {issue.type === 'error'
                    ? <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                  {issue.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* License Document Form */}
      <div className="bg-card rounded-2xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">License & Contact Information</h3>
          </div>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => { setForm(extractForm(store)); setEditing(true); }} className="gap-2">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setForm(extractForm(store)); setEditing(false); }}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending} className="gap-2">
                {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('Arkansas ABC License Number *', 'license_number', 'e.g. LR-12345')}
          {field('Contact Email *', 'email', 'store@example.com', 'email')}
          {field('Phone Number', 'phone', '(870) 555-0100', 'tel')}
          {field('Street Address *', 'address', '123 Main St')}
          {field('City', 'city', 'Pine Bluff')}
          {field('County *', 'county', 'Jefferson')}
          {field('ZIP Code', 'zip_code', '71601')}
          {field('Opening Time', 'operating_hours_start', '07:00', 'time')}
          {field('Closing Time', 'operating_hours_end', '22:00', 'time')}
        </div>

        {editing && (
          <div className="px-5 pb-4">
            <p className="text-xs text-muted-foreground">
              * Required fields for ABC compliance. Changes are saved immediately and reviewed by our compliance team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}