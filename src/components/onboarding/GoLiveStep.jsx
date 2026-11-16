import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
export default function GoLiveStep({ store }) {
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">Submit the current documents for launch review. A final administrator approval and fresh compliance, payment and operational checks are required; setup never automatically activates a retailer.</p><Button asChild variant="outline"><Link to={`/onboarding?store_id=${encodeURIComponent(store.id)}`}>Open launch review</Link></Button></div>;
}