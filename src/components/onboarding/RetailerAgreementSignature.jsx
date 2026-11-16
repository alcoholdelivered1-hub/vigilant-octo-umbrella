import React from 'react';
import RetailerAgreementField from '@/components/onboarding/RetailerAgreementField';

export default function RetailerAgreementSignature() {
  return <div className="space-y-4">
    <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Retailer / Liquor Store</p>
    <RetailerAgreementField name="signature" label="Electronic signature: type your full legal name" required />
    <RetailerAgreementField name="owner_name" label="Printed Name" required />
    <RetailerAgreementField name="title" label="Title" required />
    <RetailerAgreementField name="signature_date" label="Date" type="date" required />
  </div>;
}