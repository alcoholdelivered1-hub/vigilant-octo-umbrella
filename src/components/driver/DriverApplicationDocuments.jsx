import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

export default function DriverApplicationDocuments({ driver }) {
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');
  const open = async (key, label) => {
    const tab = window.open('', '_blank');
    if (!tab) { setError('Allow popups to view the document.'); return; }
    tab.opener = null;
    setOpening(key); setError('');
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: driver[key] });
      tab.location.replace(signed_url);
    } catch (e) { tab.close(); setError(e.message || `Unable to open ${label}.`); }
    finally { setOpening(''); }
  };
  return <div className="flex flex-wrap gap-2 mt-2">{[['license_file_uri', 'Driver license'], ['insurance_file_uri', 'Insurance']].map(([key,label]) => driver[key] && <Button key={key} size="sm" variant="outline" disabled={!!opening} onClick={() => open(key,label)}>{opening === key ? 'Opening…' : `View ${label}`}</Button>)}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}