import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

export default function StoreTemplateLink({ store }) {
  if (store.compliance_template !== 'retailer_agreement') return null;
  return <div className="mt-3 space-y-2 text-sm">
    <p className="font-medium">Onboarding: <span className="capitalize text-primary">{(store.onboarding_status || 'pending').replace(/_/g, ' ')}</span></p>
    <p className="text-muted-foreground">{store.address}, {store.city}, {store.state} {store.zip_code}</p>
    <Link to={`/retailer-contract?store_id=${encodeURIComponent(store.id)}`} className="inline-flex items-center gap-2 text-primary underline underline-offset-4"><FileText className="w-4 h-4" aria-hidden="true" />Compliance document template</Link>
  </div>;
}