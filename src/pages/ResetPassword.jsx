import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import AuthField from '@/components/auth/AuthField';
import useAuthForm from '@/components/auth/useAuthForm';
import { Button } from '@/components/ui/button';

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const { busy, error, run } = useAuthForm();
  const submit = event => { event.preventDefault(); run(async () => {
    if (password !== confirm) throw new Error('Passwords do not match.');
    await base44.auth.resetPassword({ resetToken: token, newPassword: password }); window.location.href = '/login';
  }); };
  return <AuthLayout icon={KeyRound} title="Choose a new password" subtitle="Use at least eight characters." footer={<Link className="underline" to="/forgot-password">Request a new reset link</Link>}>
    {!token ? <p role="alert">This reset link is missing or invalid. Request a new link below.</p> : <form onSubmit={submit} className="space-y-4"><AuthField id="new-password" label="New password" type="password" minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><AuthField id="confirm-password" label="Confirm password" type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button></form>}
  </AuthLayout>;
}