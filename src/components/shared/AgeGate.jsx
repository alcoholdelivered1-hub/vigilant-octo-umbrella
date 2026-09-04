import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Wine, AlertCircle } from 'lucide-react';
import BirthdateInput from '@/components/checkout/BirthdateInput';

export default function AgeGate({ onVerified }) {
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const calcAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleVerify = async () => {
    if (!dob) {
      setError('Please enter your date of birth');
      return;
    }

    const birthDate = new Date(dob);
    const age = calcAge(birthDate);

    if (isNaN(birthDate.getTime())) {
      setError('Please enter a valid date of birth');
      return;
    }

    if (age >= 21) {
      setLoading(true);
      const timestamp = new Date().toISOString();

      // Persist age verification to user record if logged in
      try {
        await base44.auth.updateMe({
          age_verified: true,
          age_verified_at: timestamp,
          date_of_birth: dob,
        });
      } catch {
        // User may not be logged in yet — store in sessionStorage as fallback
      }

      localStorage.setItem('age_verified', 'true');
      localStorage.setItem('age_verified_at', timestamp);
      localStorage.setItem('age_verified_dob', dob);

      onVerified(true);
    } else {
      setError('You must be 21 or older to use this service.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
            <Wine className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Age Verification</h1>
          <p className="text-muted-foreground mt-2">
            You must be 21 years or older to access this service.
            Arkansas law requires age verification for all alcohol purchases.
          </p>
        </div>
        <div className="bg-card rounded-2xl border p-6 space-y-4 text-left">
          <div className="space-y-2">
            <BirthdateInput
              value={dob}
              onChange={(v) => { setDob(v); setError(''); }}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <Button onClick={handleVerify} className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : (
              <ShieldCheck className="w-4 h-4 mr-2" />
            )}
            Verify My Age
          </Button>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <strong>Government-issued photo ID will be checked at delivery.</strong> The recipient must be 21 or older and must present valid ID to the driver. Delivery will be refused without a refund if the recipient is underage, lacks valid ID, or appears intoxicated.
        </div>
        <p className="text-xs text-muted-foreground">
          By continuing, you confirm you are of legal drinking age and agree to our{' '}
          <a href="/terms" className="text-primary hover:underline">Terms of Service</a>.
        </p>
      </div>
    </div>
  );
}