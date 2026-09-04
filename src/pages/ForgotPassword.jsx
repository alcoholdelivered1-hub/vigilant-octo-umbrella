import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wine, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {}
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="max-w-sm w-full">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Wine className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold mt-4">Reset Password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {submitted ? 'Check your email' : "We'll send you a reset link"}
          </p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-4">
          {submitted ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly. Check your spam folder if you don't see it.
              </p>
              <Link to="/login">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading} />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading || !email}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
            </form>
          )}
        </div>

        {!submitted && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/login" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}