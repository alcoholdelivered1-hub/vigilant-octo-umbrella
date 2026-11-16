import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

export default function RetailerEmailAlerts({ onOpen }) {
  const client = useQueryClient(), seen = useRef(null), audio = useRef(null);
  const [enabled, setEnabled] = useState(false), [error, setError] = useState('');
  const alerts = useQuery({ queryKey: ['retailer-email-alerts'], queryFn: () => base44.entities.RetailerEmailAlert.list('-created_date', 50), refetchInterval: 15000, refetchIntervalInBackground: true });
  const chime = () => {
    if (!audio.current || audio.current.state !== 'running') return;
    [660, 880, 660].forEach((frequency, index) => {
      const oscillator = audio.current.createOscillator(), gain = audio.current.createGain(), start = audio.current.currentTime + index * 0.22;
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.22, start + 0.02); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      oscillator.connect(gain); gain.connect(audio.current.destination); oscillator.start(start); oscillator.stop(start + 0.21);
    });
  };
  useEffect(() => {
    if (!alerts.data) return;
    const ids = alerts.data.map(a => `${a.gmail_message_id}:${a.store_id}`);
    if (seen.current) {
      const fresh = alerts.data.filter(a => !seen.current.has(`${a.gmail_message_id}:${a.store_id}`));
      if (fresh.length && enabled) chime();
      fresh.forEach(a => toast.info(`New retailer email: ${a.store_name}`, { description: a.subject || 'New reply', duration: 12000, action: { label: 'Read email', onClick: () => onOpen({ storeId: a.store_id, storeName: a.store_name, threadId: a.thread_id }) } }));
      if (fresh.length) client.invalidateQueries({ queryKey: ['retailer-email'] });
    }
    seen.current = new Set([...(seen.current || []), ...ids]);
  }, [alerts.data, enabled, client, onOpen]);
  useEffect(() => { const unsubscribe = base44.entities.RetailerEmailAlert.subscribe(() => client.invalidateQueries({ queryKey: ['retailer-email-alerts'] })); return () => { unsubscribe(); audio.current?.close(); }; }, [client]);
  const toggle = async () => {
    if (enabled) { setEnabled(false); return; }
    try { const Audio = window.AudioContext || window.webkitAudioContext; if (!Audio) throw new Error('Sound alerts are not supported by this browser.'); audio.current ||= new Audio(); await audio.current.resume(); if (audio.current.state !== 'running') throw new Error('Allow audio playback in your browser, then try again.'); setEnabled(true); setError(''); chime(); }
    catch (err) { setError(err.message); }
  };
  return <div className="mb-6 rounded-xl border bg-card p-4 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-sm">Retailer Gmail alerts</p><p className="text-xs text-muted-foreground">Keep this page open for new-email alerts from saved retailer contacts.</p></div><Button variant="outline" size="sm" onClick={toggle} disabled={alerts.isLoading || alerts.isError}>{enabled ? <Volume2 /> : <VolumeX />}{enabled ? 'Sound on — mute' : 'Enable sound alerts'}</Button></div>
    {(error || alerts.isError) && <p role="alert" className="text-sm text-destructive">{error || 'Could not load email alerts.'}</p>}
  </div>;
}