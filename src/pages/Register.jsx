import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import AuthField from '@/components/auth/AuthField';
import useAuthForm, { authReturnTo } from '@/components/auth/useAuthForm';
import { Button } from '@/components/ui/button';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState('');
  const { busy, error, run } = useAuthForm();
  const destination = authReturnTo();
  const submit = event => { event.preventDefault(); run(async () => {
    if (verifying) {
      const result = await base44.auth.verifyOtp({ email: email.trim(), otpCode: otp });
      if (!result.access_token) throw new Error('Verification did not complete. Please try again.');
      base44.auth.setToken(result.access_token); window.location.href = destination;
    } else {
      if (password !== confirm) throw new Error('Passwords do not match.');
      await base44.auth.register({ email: email.trim(), password }); setVerifying(true);
    }
  }); };
  return <AuthLayout icon={UserPlus} title={verifying ? 'Verify your email' : 'Create your account'} subtitle={verifying ? `Enter the code sent to ${email}.` : 'Welcome to Alcohol Delivered'} footer={<Link className="underline" to={`/login?returnTo=${encodeURIComponent(destination)}`}>Already have an account? Sign in</Link>}>
    <form onSubmit={submit} className="space-y-4">
      {verifying ? <AuthField id="signup-code" label="Verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} disabled={busy} /> : <>
        <AuthField id="signup-email" label="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
        <AuthField id="signup-password" label="Password" type="password" minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
        <AuthField id="signup-confirm" label="Confirm password" type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={busy} />
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait…' : verifying ? 'Verify email' : 'Create account'}</Button>
      {verifying ? <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => run(async () => { await base44.auth.resendOtp(email.trim()); setNotice('A new verification code has been requested.'); })}>Resend code</Button> : <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => run(() => base44.auth.loginWithProvider('google', window.location.origin + destination))}>Continue with Google</Button>}
    </form>
  </AuthLayout>;
}