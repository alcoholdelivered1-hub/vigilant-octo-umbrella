import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Wine, Truck, CheckCircle2, ArrowRight, ArrowLeft,
  Loader2, Gift, DollarSign, ShieldCheck, AlertTriangle,
  Car, Star, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { differenceInYears, parseISO } from 'date-fns';
import SocialShareButtons from '@/components/shared/SocialShareButtons';
import ReferralCard from '@/components/signup/ReferralCard';
import LiveSignupCounter from '@/components/signup/LiveSignupCounter';
import FacebookFollowLink from '@/components/shared/FacebookFollowLink';

const GIG_OPTIONS = [
  { value: 'doordash',  label: 'DoorDash' },
  { value: 'uber_eats', label: 'Uber Eats' },
  { value: 'instacart', label: 'Instacart' },
  { value: 'grubhub',   label: 'GrubHub' },
  { value: 'multiple',  label: 'Multiple apps' },
  { value: 'none',      label: 'No experience' },
  { value: 'other',     label: 'Other' },
];

const REFERRAL_OPTIONS = [
  'Facebook / Instagram', 'Friend or Family', 'Google Search',
  'Flyer / Sign', 'News / Media', 'Other',
];

// Step IDs
const STEPS = {
  ROLE:       'role',
  AGE_GATE:   'age_gate',
  INFO:       'info',
  DRIVER_EXT: 'driver_ext',
  REFERRAL:   'referral',
};

export default function EarlySignup() {
  const [step, setStep]         = useState(STEPS.ROLE);
  const [role, setRole]         = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [ageBlocked, setAgeBlocked] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [referredByCode] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', city: '',
    date_of_birth: '',
    gig_experience: '', has_vehicle: null, vehicle_type: '', has_valid_license: null,
    referral_source: '',
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const pickRole = (r) => {
    setRole(r);
    setStep(STEPS.AGE_GATE);
  };

  const handleAgeCheck = () => {
    if (!form.date_of_birth) {
      toast.error('Please enter your date of birth.');
      return;
    }
    const age = differenceInYears(new Date(), parseISO(form.date_of_birth));
    if (age < 21) {
      setAgeBlocked(true);
      return;
    }
    setStep(STEPS.INFO);
  };

  const handleInfoNext = () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Please fill in your name and email.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (role === 'driver') {
      setStep(STEPS.DRIVER_EXT);
    } else {
      setStep(STEPS.REFERRAL);
    }
  };

  const handleDriverNext = () => {
    if (!form.gig_experience) {
      toast.error('Please select your delivery experience.');
      return;
    }
    if (form.has_vehicle === null) {
      toast.error('Please indicate if you have a vehicle.');
      return;
    }
    if (form.has_valid_license === null) {
      toast.error('Please indicate if you have a valid license.');
      return;
    }
    setStep(STEPS.REFERRAL);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const age = differenceInYears(new Date(), parseISO(form.date_of_birth));
    const code = generateReferralCode(form.full_name);
    const payload = {
      role,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      city: form.city,
      date_of_birth: form.date_of_birth,
      age_verified: age >= 21,
      referral_source: form.referral_source,
      status: 'pending',
      referral_code: code,
      referred_by_code: referredByCode || undefined,
      ...(role === 'driver' && {
        gig_experience: form.gig_experience,
        has_vehicle: form.has_vehicle,
        vehicle_type: form.vehicle_type,
        has_valid_license: form.has_valid_license,
      }),
    };

    try {
      await base44.entities.EarlySignup.create(payload);
      // Also fire notification (best-effort)
      base44.functions.invoke('notifyNewSignup', {
        data: { ...payload, source: 'early_signup' },
        event: { type: 'early_signup' },
      }).catch(() => {});
      setReferralCode(code);
      setSubmitted(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  // ── Age blocked ──────────────────────────────────────────────
  if (ageBlocked) return (
    <PageShell>
      <div className="text-center space-y-4 py-6">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="font-display text-2xl font-bold">Age Requirement Not Met</h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
          You must be <strong>21 years of age or older</strong> to use Alcohol Delivered — as a customer or a driver. This is required by Arkansas law.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 text-left">
          <p className="font-semibold mb-1">Why 21+?</p>
          <p className="text-xs">Arkansas ABC regulations require that anyone involved in the purchase or delivery of alcohol — including customers and delivery drivers — must be at least 21 years of age.</p>
        </div>
      </div>
    </PageShell>
  );

  // ── Submitted ─────────────────────────────────────────────────
  if (submitted) return (
    <PageShell>
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">You're on the list!</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Thanks, <strong>{form.full_name.split(' ')[0]}</strong>!{' '}
            {role === 'customer'
              ? "We'll notify you the moment Alcohol Delivered launches. Early signups get priority access and a free first delivery."
              : "Our team will reach out soon with onboarding details. Early drivers get priority dispatch and launch-week bonuses."}
          </p>
        </div>
        <div className={cn('rounded-xl p-4 text-left text-sm space-y-2', role === 'customer' ? 'bg-secondary/10 border border-secondary/20' : 'bg-primary/10 border border-primary/20')}>
          {role === 'customer' ? (
            <>
              <p className="font-semibold text-secondary flex items-center gap-2"><Gift className="w-4 h-4" /> Early customer perks:</p>
              <p className="text-muted-foreground">• First delivery FREE</p>
              <p className="text-muted-foreground">• 30-day free trial, no card required</p>
              <p className="text-muted-foreground">• Priority access at launch</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-primary flex items-center gap-2"><DollarSign className="w-4 h-4" /> Early driver perks:</p>
              <p className="text-muted-foreground">• Bonus earnings during launch week</p>
              <p className="text-muted-foreground">• Priority dispatch for first 30 days</p>
              <p className="text-muted-foreground">• Fast-tracked onboarding & training</p>
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">We'll email <strong>{form.email}</strong>. No spam, ever.</p>

        <div className="border-t pt-4">
          <ReferralCard referralCode={referralCode} role={role} fullName={form.full_name} />
        </div>
        <div className="pt-2">
          <FacebookFollowLink />
        </div>
      </div>
    </PageShell>
  );

  // ── Step: Role ────────────────────────────────────────────────
  if (step === STEPS.ROLE) return (
    <PageShell>
      <p className="text-center font-semibold text-lg mb-4">I want to sign up as a…</p>
      <div className="grid grid-cols-2 gap-4">
        <RoleCard
          icon={<Wine className="w-7 h-7 text-secondary" />}
          bg="bg-secondary/10 group-hover:bg-secondary/20"
          border="hover:border-secondary"
          title="Customer"
          sub="Order alcohol delivered to my door"
          onClick={() => pickRole('customer')}
        />
        <RoleCard
          icon={<Truck className="w-7 h-7 text-primary" />}
          bg="bg-primary/10 group-hover:bg-primary/20"
          border="hover:border-primary"
          title="Driver"
          sub="Earn money making deliveries"
          onClick={() => pickRole('driver')}
        />
      </div>
      <LiveSignupCounter />
      <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Must be 21+ to participate
      </p>
    </PageShell>
  );

  // ── Step: Age Gate ─────────────────────────────────────────────
  if (step === STEPS.AGE_GATE) return (
    <PageShell>
      <StepHeader role={role} onBack={() => { setRole(null); setStep(STEPS.ROLE); }} />
      <div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Age Verification Required</p>
            <p className="text-xs mt-0.5">You must be <strong>21 years or older</strong> to {role === 'customer' ? 'order alcohol' : 'deliver alcohol'} in Arkansas. This is required by law.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Date of Birth *
          </Label>
          <Input
            type="date"
            max={new Date().toISOString().split('T')[0]}
            value={form.date_of_birth}
            onChange={e => update('date_of_birth', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Must be 21 or older to continue.</p>
        </div>
        <Button onClick={handleAgeCheck} className="w-full h-11 rounded-xl">
          <ArrowRight className="w-4 h-4 mr-2" /> Verify Age & Continue
        </Button>
      </div>
    </PageShell>
  );

  // ── Step: Contact Info ─────────────────────────────────────────
  if (step === STEPS.INFO) return (
    <PageShell>
      <StepHeader role={role} onBack={() => setStep(STEPS.AGE_GATE)} label="Back" />
      <StepIndicator current={1} total={role === 'driver' ? 3 : 2} />
      <div className="space-y-4">
        <PerksBanner role={role} />
        <div className="space-y-1.5">
          <Label>Full Name *</Label>
          <Input value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="John Smith" />
        </div>
        <div className="space-y-1.5">
          <Label>Email Address *</Label>
          <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(870) 555-0123" />
        </div>
        <div className="space-y-1.5">
          <Label>City / Area <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Pine Bluff, AR" />
        </div>
        <Button onClick={handleInfoNext} className="w-full h-11 rounded-xl">
          <ArrowRight className="w-4 h-4 mr-2" /> Continue
        </Button>
      </div>
    </PageShell>
  );

  // ── Step: Driver Details ───────────────────────────────────────
  if (step === STEPS.DRIVER_EXT) return (
    <PageShell>
      <StepHeader role={role} onBack={() => setStep(STEPS.INFO)} label="Back" />
      <StepIndicator current={2} total={3} />
      <div className="space-y-5">
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-muted-foreground" /> Gig Delivery Experience
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {GIG_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('gig_experience', opt.value)}
                className={cn(
                  'text-sm px-3 py-2.5 rounded-xl border-2 text-left font-medium transition-all',
                  form.gig_experience === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <Car className="w-4 h-4 text-muted-foreground" /> Do you have a reliable vehicle?
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => update('has_vehicle', opt.v)}
                className={cn(
                  'text-sm px-3 py-2.5 rounded-xl border-2 font-medium transition-all',
                  form.has_vehicle === opt.v
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.has_vehicle && (
            <div className="mt-2">
              <Input
                value={form.vehicle_type}
                onChange={e => update('vehicle_type', e.target.value)}
                placeholder="e.g. 2020 Toyota Camry"
                className="mt-1"
              />
            </div>
          )}
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" /> Do you have a valid driver's license?
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map(opt => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => update('has_valid_license', opt.v)}
                className={cn(
                  'text-sm px-3 py-2.5 rounded-xl border-2 font-medium transition-all',
                  form.has_valid_license === opt.v
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {(form.has_vehicle === false || form.has_valid_license === false) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            ⚠️ Drivers must have a valid license and reliable vehicle. You can still sign up and we'll reach out when requirements are met.
          </div>
        )}

        <Button onClick={handleDriverNext} className="w-full h-11 rounded-xl">
          <ArrowRight className="w-4 h-4 mr-2" /> Continue
        </Button>
      </div>
    </PageShell>
  );

  // ── Step: Referral + Submit ────────────────────────────────────
  if (step === STEPS.REFERRAL) return (
    <PageShell>
      <StepHeader role={role} onBack={() => setStep(role === 'driver' ? STEPS.DRIVER_EXT : STEPS.INFO)} label="Back" />
      <StepIndicator current={role === 'driver' ? 3 : 2} total={role === 'driver' ? 3 : 2} />
      <div className="space-y-5">
        <div>
          <Label className="mb-2 block">How did you hear about us? <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <div className="grid grid-cols-2 gap-2">
            {REFERRAL_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => update('referral_source', opt)}
                className={cn(
                  'text-sm px-3 py-2.5 rounded-xl border-2 font-medium text-left transition-all',
                  form.referral_source === opt
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground text-sm">Almost done! 🎉</p>
          <p>By submitting, you confirm you are <strong>21 years or older</strong> and agree to receive launch updates from Alcohol Delivered.</p>
        </div>

        <Button onClick={handleSubmit} disabled={loading} className="w-full h-11 rounded-xl">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
            : <><CheckCircle2 className="w-4 h-4 mr-2" /> Reserve My Spot</>
          }
        </Button>
        <p className="text-xs text-muted-foreground text-center">No spam. We'll only contact you about the launch.</p>
      </div>
    </PageShell>
  );

  return null;
}

// ── Helper components ──────────────────────────────────────────

function generateReferralCode(name) {
  const initials = (name || 'AD').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${initials}${random}`;
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <img
            src="https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c"
            alt="Alcohol Delivered"
            className="h-20 w-28 object-fill mx-auto"
          />
          <h1 className="font-display text-3xl font-bold">Get Early Access</h1>
          <p className="text-muted-foreground text-sm">Be first when Alcohol Delivered launches in Pine Bluff, AR</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ role, onBack }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', role === 'customer' ? 'bg-secondary/10' : 'bg-primary/10')}>
        {role === 'customer' ? <Wine className="w-5 h-5 text-secondary" /> : <Truck className="w-5 h-5 text-primary" />}
      </div>
      <div>
        <p className="font-semibold text-sm">{role === 'customer' ? 'Customer Early Access' : 'Driver Early Access'}</p>
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
      </div>
    </div>
  );
}

function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn('h-1.5 flex-1 rounded-full transition-all', i < current ? 'bg-primary' : 'bg-muted')}
        />
      ))}
    </div>
  );
}

function PerksBanner({ role }) {
  return (
    <div className={cn('rounded-xl p-3 text-xs font-semibold', role === 'customer' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary')}>
      {role === 'customer'
        ? '🎁 Early customers get: free first delivery + 30-day free trial'
        : '💰 Early drivers get: launch week bonuses + priority dispatch'}
    </div>
  );
}

function RoleCard({ icon, bg, border, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn('flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-border hover:bg-muted/30 transition-all group', border)}
    >
      <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center transition-colors', bg)}>
        {icon}
      </div>
      <div className="text-center">
        <p className="font-bold text-base">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </button>
  );
}