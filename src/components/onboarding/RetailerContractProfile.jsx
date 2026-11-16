import React from 'react';
import { useAgreement } from '@/components/onboarding/RetailerAgreementContext';
import RetailerAgreementField from '@/components/onboarding/RetailerAgreementField';

export default function RetailerContractProfile() {
  const agreement = useAgreement();
  const fields = ['store_name','license_number','address','city_state_zip','owner_name','title','phone','email'];
  return <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
    <p className="no-print text-sm text-muted-foreground">{agreement.details.store.name} · Complete your retailer details below. Drafts save automatically; signing submits the agreement for review.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.map(key => <RetailerAgreementField key={key} name={key} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} required />)}</div>
  </div>;
}