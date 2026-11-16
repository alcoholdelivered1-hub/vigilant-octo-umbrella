import React, { useId } from 'react';
import { Input } from '@/components/ui/input';
import { useAgreement } from '@/components/onboarding/RetailerAgreementContext';

export default function RetailerAgreementField({ name, label, type = 'text', required = false, className = '' }) {
  const id = useId();
  const agreement = useAgreement();
  return <div className={className}>
    <label htmlFor={id} className="block text-xs text-muted-foreground mb-1">{label || agreement.details?.fields[name]}{required ? ' *' : ''}</label>
    <Input id={id} name={name} type={type} required={required} maxLength={250} min={type === 'number' ? 1 : undefined} max={type === 'number' ? 999 : undefined} disabled={agreement.record?.status === 'submitted' || agreement.isSubmitting || agreement.details?.controlled_fields?.includes(name) || agreement.details?.identity_fields?.includes(name) || !!agreement.details?.ambiguity?.length} value={agreement.form[name] || ''} onChange={e => agreement.update(name,e.target.value)} className="print:hidden" />
    <p className="hidden print:block border-b min-h-6">{agreement.form[name] || '____________________'}</p>
  </div>;
}