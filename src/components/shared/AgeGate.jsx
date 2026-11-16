import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Wine } from 'lucide-react';

export default function AgeGate({ onVerified }) {
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');

  const handleVerify = () => {
    if (!dob) {
      setError('Please enter your date of birth');
      return;
    }
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    
    if (age >= 21) {
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
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={dob}
              onChange={(e) => { setDob(e.target.value); setError(''); }}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleVerify} className="w-full" size="lg">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Verify My Age
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          By continuing, you confirm you are of legal drinking age and agree to our Terms of Service.
        </p>
      </div>
    </div>
  );
}