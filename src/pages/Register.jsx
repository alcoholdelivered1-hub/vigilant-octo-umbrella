import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wine, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

export default function Register() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const fromUrl = new URLSearchParams(window.location.search).get('from_url') || '/';

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await base44.auth.register({ email, password });
      setStep(2);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Registration failed. Please try again.');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otpCode) {
      setError('Please enter the verification code');
      return;
    }
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        window.location.href = fromUrl;
      } else {
        await base44.auth.loginViaEmailPassword(email, password);
        window.location.href = fromUrl;
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Invalid verification code');
    }
    setLoading(false);
  };

  const handleResendOtp = async () => {
    setResending(true);
    try {
      await base44.auth.resendOtp(email);
    } catch {}
    setResending(false);
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider('google', fromUrl);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="max-w-sm w-full">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Wine className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold mt-4">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1 ? 'Sign up for a free account' : 'Verify your email'}
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" disabled={loading} />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center space-y-2">
                <Mail className="w-8 h-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  We sent a 6-digit code to <strong>{email}</strong>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-bold h-12"
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading || otpCode.length < 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Verify & Continue
              </Button>
              <button type="button" onClick={handleResendOtp} disabled={resending} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors">
                {resending ? 'Resending...' : "Didn't get it? Resend code"}
              </button>
            </form>
          )}

          {step === 1 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
              <Button variant="outline" className="w-full h-11 rounded-xl" onClick={handleGoogle} disabled={loading}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>
            </>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}