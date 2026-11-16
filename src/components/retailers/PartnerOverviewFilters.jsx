import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export default function PartnerOverviewFilters({ search, onSearch, stage, onStage, documents, onDocuments }) {
  const selectClass = 'min-h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground';
  return <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
    <label className="space-y-1.5 text-sm font-medium">Find a partner<Input className="min-h-11" placeholder="Name, city or email" value={search} onChange={event => onSearch(event.target.value)} /></label>
    <label className="space-y-1.5 text-sm font-medium">Onboarding stage<Select value={stage} onValueChange={onStage}><SelectTrigger aria-label="Onboarding stage" className={selectClass}><SelectValue /></SelectTrigger><SelectContent>{[['pending','Pending'],['invited','Invited'],['contract_sent','Contract sent'],['contract_signed','Contract signed'],['inventory_added','Inventory added'],['live','Recorded live']].map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
    <label className="space-y-1.5 text-sm font-medium">Document attention<Select value={documents} onValueChange={onDocuments}><SelectTrigger aria-label="Document attention" className={selectClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All partners</SelectItem><SelectItem value="missing">Missing required documents</SelectItem><SelectItem value="review">Awaiting review</SelectItem><SelectItem value="corrections">Corrections or expired evidence</SelectItem></SelectContent></Select></label>
  </div>;
}