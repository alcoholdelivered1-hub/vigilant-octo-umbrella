import React from 'react';
import { useAgreement } from '@/components/onboarding/RetailerAgreementContext';

export default function RetailerAgreementForm({ children }) {
  const agreement = useAgreement();
  if (agreement.loadError) return <p role="alert" className="text-destructive">{agreement.loadError}</p>;
  if (agreement.loading) return <p role="status">Loading agreement…</p>;
  if (!agreement.storeId) return <p className="rounded-xl border p-5">Choose your retailer above to fill out and save the agreement. If your store is not listed, contact John Bess at 870-718-1521 to link your account.</p>;
  return <form id="retailer-agreement-form" onSubmit={e => { e.preventDefault(); agreement.submit(); }} className="print-page bg-card border rounded-2xl shadow-sm p-5 sm:p-10 space-y-8 text-sm leading-relaxed text-card-foreground">{children}</form>;
}