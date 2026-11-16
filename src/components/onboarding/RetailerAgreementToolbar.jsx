import React from 'react';
import { useAgreement } from '@/components/onboarding/RetailerAgreementContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RetailerAgreementToolbar() {
  const agreement = useAgreement();
  return <div className="no-print mb-6 rounded-xl border bg-card p-4 space-y-2">
    <label className="block text-sm font-semibold" htmlFor="agreement-retailer">Retailer</label>
    <Select value={agreement.storeId} onValueChange={agreement.setStoreId} disabled={agreement.busy || !agreement.stores.length}>
      <SelectTrigger id="agreement-retailer" className="w-full rounded-md border bg-background px-3 py-3"><SelectValue placeholder="Select your store" /></SelectTrigger>
      <SelectContent>
        {agreement.stores.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
    <p role="status" className="text-sm text-muted-foreground">{agreement.status}</p>
    {agreement.error && <p role="alert" className="text-sm text-destructive">{agreement.error}</p>}
  </div>;
}