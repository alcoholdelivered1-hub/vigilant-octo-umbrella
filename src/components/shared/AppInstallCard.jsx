import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
export default function AppInstallCard() {
  const [prompt,setPrompt] = useState(null), [installed,setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  useEffect(() => {
    const available = event => { event.preventDefault(); setPrompt(event); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt',available); window.addEventListener('appinstalled',complete);
    return () => {window.removeEventListener('beforeinstallprompt',available); window.removeEventListener('appinstalled',complete);};
  },[]);
  const install = async () => {
    setBusy(true); setError('');
    try {await prompt.prompt(); await prompt.userChoice; setPrompt(null);} catch(e) {setError(e.message);} finally {setBusy(false);}
  };
  if (installed) return <p className="text-sm text-muted-foreground">Alcohol Delivered is open in app mode on this device.</p>;
  return <section className="rounded-xl border bg-card p-4 space-y-3"><h2 className="font-semibold">Add Alcohol Delivered to your phone or laptop</h2>{prompt && <Button onClick={install} disabled={busy}><Download />{busy ? 'Opening installation…' : 'Install on this device'}</Button>}<ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2"><li><strong>iPhone/iPad:</strong> Open in Safari, tap Share → Add to Home Screen → Add.</li><li><strong>Android:</strong> In Chrome, open the menu → Install app or Add to Home screen.</li><li><strong>Laptop:</strong> In Chrome or Edge, use the install icon in the address bar or browser menu; otherwise bookmark this page.</li></ul><p className="text-sm text-muted-foreground">Confirm installation yourself on each device. Installing a shortcut does not automatically enable notifications.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</section>;
}