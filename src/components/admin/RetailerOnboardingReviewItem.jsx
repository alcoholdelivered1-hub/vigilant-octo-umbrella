import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function RetailerOnboardingReviewItem({ item, onReviewed }) {
  const [opening, setOpening] = useState(false), [error, setError] = useState('');
  const [viewed, setViewed] = useState(false);
  const openDocument = async () => {
    setOpening(true); setError('');
    const tab = window.open('', '_blank');
    try {
      if (!tab) throw new Error('Allow popups to view this document.');
      tab.opener = null;
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: item.file_uri });
      tab.location.replace(signed_url); setViewed(true);
    } catch (err) { tab?.close(); setError(err.message); }
    finally { setOpening(false); }
  };
  return <div className="border-t pt-3 space-y-2">
    <p className="text-sm font-medium break-words">{item.label}</p>
    <p className="text-xs text-muted-foreground">Submitted {new Date(item.submitted_at || item.created_date).toLocaleString()}</p>
    <div className="flex flex-wrap gap-2">
      {item.entity === 'RetailerAgreement' ? <Button asChild size="sm" variant="outline"><a href={`/retailer-contract?store_id=${encodeURIComponent(item.store_id)}`} target="_blank" rel="noopener noreferrer" onClick={() => setViewed(true)}>View agreement</a></Button> : <Button size="sm" variant="outline" disabled={opening} onClick={openDocument}>{opening ? 'Opening…' : 'View document'}</Button>}
      <Button size="sm" disabled={!viewed || opening} onClick={() => onReviewed(item)}>Mark reviewed</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}