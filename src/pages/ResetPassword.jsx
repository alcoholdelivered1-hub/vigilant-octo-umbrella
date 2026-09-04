import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wine, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) {
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
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      setSuccess(true);
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Password reset failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="max-w-sm w-full">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
            <Wine className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold mt-4">New Password</h1>
          <p className="text-sm text-muted-foreground mt-1">Set a new password for your account</p>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Your password has been reset successfully. Redirecting to login...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" disabled={loading} />
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Reset Password
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/login" className="text-primary hover:underline font-medium">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}