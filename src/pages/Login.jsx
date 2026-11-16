import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import AuthLayout from '@/components/AuthLayout';
import AuthField from '@/components/auth/AuthField';
import useAuthForm, { authReturnTo } from '@/components/auth/useAuthForm';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAuthForm();
  const destination = authReturnTo();
  const query = `?returnTo=${encodeURIComponent(destination)}`;
  const submit = event => { event.preventDefault(); run(async () => { await base44.auth.loginViaEmailPassword(email.trim(), password); window.location.href = destination; }); };
  return <AuthLayout icon={LogIn} title="Welcome back" subtitle="Sign in to Alcohol Delivered" footer={<Link className="underline" to={`/register${query}`}>Create an account</Link>}>
    <form onSubmit={submit} className="space-y-4" aria-describedby={error ? 'login-error' : undefined}>
      <AuthField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
      <AuthField id="login-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
      {error && <p id="login-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
      <Button type="button" variant="outline" disabled={busy} className="w-full" onClick={() => run(() => base44.auth.loginWithProvider('google', window.location.origin + destination))}>Continue with Google</Button>
      <Link to="/cityhive-login" className="block">
        <Button type="button" variant="outline" disabled={busy} className="w-full">
          <Store className="w-4 h-4" />
          CityHive Merchant Login
        </Button>
      </Link>
      <Link className="inline-block text-sm text-primary underline" to={`/forgot-password${query}`}>Forgot password?</Link>
    </form>
  </AuthLayout>;
}