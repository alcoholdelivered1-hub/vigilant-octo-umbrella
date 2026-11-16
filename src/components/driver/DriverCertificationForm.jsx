import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const fields = [['training_completed_date', 'Training completion date', 'date'], ['training_expires_date', 'Certificate renewal / expiration date', 'date'], ['training_provider', 'Training provider', 'text'], ['abc_approval_reference', 'ABC program approval reference', 'text'], ['certificate_reference', 'Training certificate reference', 'text'], ['awareness_form_reference', 'Completed Server Awareness form reference', 'text'], ['license_expiration_date', 'Driver license expiration date', 'date']];
export default function DriverCertificationForm({ driver, record, onSaved }) {
  const [form, setForm] = useState(Object.fromEntries(fields.map(([key]) => [key, record?.[key] || ''])));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (action) => {
    setBusy(true); setError('');
    try {
      const { data } = await base44.functions.invoke('reviewDriverCertification', { driver_id: driver.id, action, confirmed, ...form });
      if (!data.success) throw new Error(data.error || 'Review could not be saved.');
      onSaved();
    } catch (err) { setError(err.response?.data?.error || err.message); }
    finally { setBusy(false); }
  };
  return <form className="space-y-3" onSubmit={e => { e.preventDefault(); save('approve'); }}>
    <p className="text-sm text-muted-foreground">Review actual evidence for {driver.name}. An app quiz is not ABC program approval. Keep the supporting documents identified by these references.</p>
    {fields.map(([key, label, type]) => <label key={key} className="block text-sm">{label}<Input type={type} required maxLength={250} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed ABC-approved annual training, certificate, completed awareness form, valid license, age 21+ and real background-check clearance with no felony conviction.</label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={busy || !confirmed}>{busy ? 'Saving…' : 'Approve reviewed evidence'}</Button>{record?.status === 'approved' && <Button type="button" variant="outline" disabled={busy} onClick={() => save('revoke')}>Revoke approval</Button>}</div>
  </form>;
}