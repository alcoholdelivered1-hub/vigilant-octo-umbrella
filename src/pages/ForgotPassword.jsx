import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import AuthField from '@/components/auth/AuthField';
import useAuthForm, { authReturnTo } from '@/components/auth/useAuthForm';
import { Button } from '@/components/ui/button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, run } = useAuthForm();
  const submit = event => { event.preventDefault(); run(async () => {
    try { await base44.auth.resetPasswordRequest(email.trim()); } catch { /* Do not disclose whether this account exists. */ }
    setSent(true);
  }); };
  return <AuthLayout icon={KeyRound} title="Reset your password" subtitle="Request a secure password reset link." footer={<Link className="underline" to={`/login?returnTo=${encodeURIComponent(authReturnTo())}`}>Back to sign in</Link>}>
    {sent ? <p role="status">If an account exists for this email, you’ll receive password reset instructions.</p> : <form onSubmit={submit} className="space-y-4"><AuthField id="reset-email" label="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /><Button className="w-full" disabled={busy}>{busy ? 'Requesting…' : 'Send reset instructions'}</Button></form>}
  </AuthLayout>;
}