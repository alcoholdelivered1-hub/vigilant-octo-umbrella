import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function LaunchEvidenceForm({ action, title, description, fields, initialValues = {}, attestation, onComplete, context = {} }) {
  const [values, setValues] = useState(initialValues);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setMessage(''); setFailed(false);
    try {
      const { data } = await base44.functions.invoke('saveBeverageKingLaunchEvidence', { ...values, ...context, action, reviewed });
      if (data.error) throw new Error(data.error);
      setMessage(data.message); setReviewed(false);
      await onComplete();
    } catch (error) {
      setFailed(true); setMessage(error.response?.data?.error || error.message);
    } finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby={`${action}-title`}>
    <h3 id={`${action}-title`} className="font-semibold">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
    {fields.map(({ name, label, type = 'text', maxLength = 500 }) => <div key={name} className="space-y-1">
      <Label htmlFor={`${action}-${name}`}>{label}</Label>
      {type === 'textarea'
        ? <Textarea id={`${action}-${name}`} required maxLength={maxLength} value={values[name] || ''} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} />
        : <Input id={`${action}-${name}`} type={type} required maxLength={maxLength} max={type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined} value={values[name] || ''} onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))} />}
    </div>)}
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" required checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1" />{attestation}</label>
    <Button type="submit" disabled={busy || !reviewed}>{busy ? 'Saving…' : 'Save reviewed evidence'}</Button>
    {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>{message}</p>}
  </form>;
}