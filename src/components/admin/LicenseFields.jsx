import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export default function LicenseFields({ form, onChange, disabled }) {
  return <>
    <div className="space-y-1.5"><Label htmlFor="license-status">License status</Label>
      <Select value={form.license_status} onValueChange={value => onChange('license_status', value)} disabled={disabled}>
        <SelectTrigger id="license-status" className="w-full min-h-11 rounded-md border border-input bg-background px-3 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unknown">Not verified</SelectItem><SelectItem value="pending">PENDING</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="expired">Expired</SelectItem><SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-1.5"><Label htmlFor="license-expiration">ABC license expiration</Label><Input id="license-expiration" type="date" value={form.license_expiration_date} disabled={disabled} onChange={e => onChange('license_expiration_date', e.target.value)} /></div>
  </>;
}