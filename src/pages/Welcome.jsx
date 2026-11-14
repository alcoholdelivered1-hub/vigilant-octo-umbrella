import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Wine, ArrowRight, ArrowLeft, CheckCircle2, Star, Gift, MapPin, Smartphone, Mail, Loader2, Truck } from 'lucide-react';
import FacebookFollowLink from '@/components/shared/FacebookFollowLink';

import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const SPIRIT_BRANDS = [
  { id: 'hennessy', name: 'Hennessy', category: 'Cognac' },
  { id: 'jack_daniels', name: "Jack Daniel's", category: 'Whiskey' },
  { id: 'crown_royal', name: 'Crown Royal', category: 'Whiskey' },
  { id: 'makers_mark', name: "Maker's Mark", category: 'Bourbon' },
  { id: 'titos', name: "Tito's Vodka", category: 'Vodka' },
  { id: 'grey_goose', name: 'Grey Goose', category: 'Vodka' },
  { id: 'patron', name: 'Patron', category: 'Tequila' },
  { id: 'jose_cuervo', name: 'Jose Cuervo', category: 'Tequila' },
  { id: 'bacardi', name: 'Bacardi', category: 'Rum' },
  { id: 'captain_morgan', name: 'Captain Morgan', category: 'Rum' },
  { id: 'budweiser', name: 'Budweiser', category: 'Beer' },
  { id: 'bud_light', name: 'Bud Light', category: 'Beer' },
  { id: 'modelo', name: 'Modelo', category: 'Beer' },
  { id: 'corona', name: 'Corona', category: 'Beer' },
  { id: 'barefoot', name: 'Barefoot', category: 'Wine' },
  { id: 'yellowtail', name: 'Yellow Tail', category: 'Wine' },
  { id: 'ej_brandy', name: 'E&J Brandy', category: 'Brandy' },
  { id: 'smirnoff', name: 'Smirnoff', category: 'Vodka' },
];

const TOTAL_STEPS = 7;

function ProgressBar({ step }) {
  return (
    <div className="w-full bg-muted rounded-full h-1.5 mb-8">
      <div
        className="bg-primary h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  // If localStorage says onboarding is done, skip spinner entirely
  const [checking, setChecking] = useState(
    localStorage.getItem('onboarding_complete') !== 'true'
  );

  useEffect(() => {
    // Already marked complete locally — redirect immediately
    if (localStorage.getItem('onboarding_complete') === 'true') {
      navigate('/stores', { replace: true });
      return;
    }
    // Wait for AuthContext to finish loading
    if (isLoadingAuth) return;
    // Authenticated returning user with onboarding complete → go to stores
    if (isAuthenticated && user?.onboarding_complete) {
      localStorage.setItem('onboarding_complete', 'true');
      navigate('/stores', { replace: true });
      return;
    }
    // Not authenticated or onboarding not complete → show onboarding
    setChecking(false);
  }, [isLoadingAuth, isAuthenticated, user, navigate]);

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', dob: '',
    terms_accepted: false, privacy_accepted: false,
    favorite_brands: [],
    preferred_stores: [],
    allow_tracking: false,
    referral_code: new URLSearchParams(window.location.search).get('ref') || '',
  });
  const [referralApplied, setReferralApplied] = useState(false);
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [serverCode, setServerCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);


  const { data: stores = [] } = useQuery({
    queryKey: ['stores-for-onboarding'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 50),
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleBrand = (id) => {
    setForm(prev => ({
      ...prev,
      favorite_brands: prev.favorite_brands.includes(id)
        ? prev.favorite_brands.filter(b => b !== id)
        : [...prev.favorite_brands, id],
    }));
  };

  const toggleStore = (id) => {
    setForm(prev => ({
      ...prev,
      preferred_stores: prev.preferred_stores.includes(id)
        ? prev.preferred_stores.filter(s => s !== id)
        : [...prev.preferred_stores, id],
    }));
  };

  const calcAge = (dob) => {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const sendVerification = async () => {
    setSendingEmail(true);
    try {
      const res = await base44.functions.invoke('sendVerificationEmail', { email: form.email, first_name: form.first_name });
      setServerCode(res.data.code);
      toast.success(`Verification code sent to ${form.email}`);
    } catch (e) {
      toast.error('Failed to send email. Please try again.');
    }
    setSendingEmail(false);
  };

  const verifyCode = () => {
    if (verificationCode === serverCode) {
      setEmailVerified(true);
      toast.success('Email verified!');
      setStep(s => s + 1);
    } else {
      toast.error('Incorrect code. Please try again.');
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.first_name || !form.last_name || !form.email || !form.phone || !form.dob) {
        toast.error('Please fill in all fields'); return false;
      }
      if (!/\S+@\S+\.\S+/.test(form.email)) {
        toast.error('Please enter a valid email address'); return false;
      }
      if (calcAge(form.dob) < 21) {
        toast.error('You must be 21 or older to use this service'); return false;
      }
    }
    if (step === 2) {
      if (!emailVerified) {
        toast.error('Please verify your email first'); return false;
      }
    }
    if (step === 3) {
      if (!form.terms_accepted || !form.privacy_accepted) {
        toast.error('Please accept all terms to continue'); return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const back = () => { if (step > 1) setStep(s => s - 1); };

  const applyReferral = async () => {
    if (!form.referral_code) return;
    setApplyingReferral(true);
    try {
      await base44.functions.invoke('processReferral', { referral_code: form.referral_code.trim().toUpperCase() });
      setReferralApplied(true);
      toast.success('Referral code applied! You earned $3.00 credit.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Invalid referral code');
    }
    setApplyingReferral(false);
  };

  const finish = async () => {
    setLoading(true);
    try {
      // Generate a unique referral code from the form name (works without login)
      const nameBase = (form.first_name + form.last_name).replace(/\s+/g, '').toUpperCase().slice(0, 4) || 'USER';
      const code = nameBase + Math.random().toString(36).toUpperCase().slice(2, 6);

      const onboardingData = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        dob: form.dob,
        favorite_brands: form.favorite_brands,
        preferred_stores: form.preferred_stores,
        allow_tracking: form.allow_tracking,
        referral_code: code,
        free_trial_started: new Date().toISOString(),
        free_trial_ends: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Send sign-up alert to manager (fire-and-forget)
      base44.functions.invoke('notifyNewSignup', {
        data: { email: form.email, full_name: `${form.first_name} ${form.last_name}`, role: 'user', created_date: new Date().toISOString() },
        event: { type: 'create' },
      }).catch(() => {});

      // Persist onboarding data to the user record only if authenticated
      if (isAuthenticated) {
        await base44.auth.updateMe({
          referral_code: code,
          onboarding_complete: true,
          onboarding_data: onboardingData,
        });
      }

      // Always save locally so the app recognizes onboarding is done
      localStorage.setItem('age_verified', 'true');
      localStorage.setItem('onboarding_complete', 'true');
      localStorage.setItem('referral_code', code);
      localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));
      toast.success('Welcome to Alcohol Delivered! Your free 30 days have started.');
      navigate('/stores');
    } catch {
      toast.error('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c"
            alt="Alcohol Delivered"
            className="h-36 w-48 object-fill"
          />
        </div>
        <p className="text-center text-sm text-muted-foreground mb-4">Pine Bluff, AR · 21+ Only · Licensed & Compliant</p>
        <div className="mb-4">
          <FacebookFollowLink />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            className="rounded-xl h-auto py-3 px-3 text-sm font-semibold flex flex-col items-center gap-1"
            onClick={() => navigate('/login')}
          >
            <Wine className="w-5 h-5" />
            <span>I'm a Customer</span>
            <span className="text-[10px] font-normal opacity-80">Order alcohol</span>
          </Button>
          <Button
            variant="outline"
            className="rounded-xl h-auto py-3 px-3 text-sm font-medium flex flex-col items-center gap-1"
            onClick={() => navigate('/drive')}
          >
            <Truck className="w-5 h-5 text-primary" />
            <span>I'm a Driver</span>
            <span className="text-[10px] font-normal text-muted-foreground">Earn $4.75/delivery</span>
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground -mt-3 mb-6">
          Want to do both? Sign up as a customer, then apply to drive anytime from the menu.
        </p>

        <ProgressBar step={step} />

        <div className="bg-card rounded-2xl border shadow-sm p-6">

          {/* STEP 1 — Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="font-display text-xl font-bold">Create Your Account</h2>
                <p className="text-sm text-muted-foreground mt-1">Must be 21+ to register</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input value={form.first_name} onChange={e => update('first_name', e.target.value)} placeholder="John" />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input value={form.last_name} onChange={e => update('last_name', e.target.value)} placeholder="Smith" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email Address *</Label>
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number *</Label>
                <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(870) 555-0123" />
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth * <span className="text-muted-foreground">(Must be 21+)</span></Label>
                <Input type="date" value={form.dob} onChange={e => update('dob', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                {form.dob && calcAge(form.dob) < 21 && (
                  <p className="text-xs text-destructive">You must be 21 or older to use this service.</p>
                )}
                {form.dob && calcAge(form.dob) >= 21 && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Age verified</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 — Email Verification */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <Mail className="w-8 h-8 text-primary mx-auto mb-2" />
                <h2 className="font-display text-xl font-bold">Verify Your Email</h2>
                <p className="text-sm text-muted-foreground mt-1">We'll send a 6-digit code to <strong>{form.email}</strong></p>
              </div>
              {!serverCode ? (
                <>
                  <Button onClick={sendVerification} disabled={sendingEmail} className="w-full rounded-xl h-11">
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                    {sendingEmail ? 'Sending...' : 'Send Verification Code'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Don't see it? Check your spam or junk folder.
                  </p>
                </>
              ) : emailVerified ? (
                <div className="flex items-center justify-center gap-2 py-4 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-5 h-5" /> Email verified!
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Enter 6-digit code</Label>
                    <Input
                      value={verificationCode}
                      onChange={e => setVerificationCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-bold h-12"
                    />
                  </div>
                  <Button onClick={verifyCode} className="w-full rounded-xl" disabled={verificationCode.length < 6}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Verify Code
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Didn't get it? Check your spam or junk folder.
                  </p>
                  <button onClick={sendVerification} disabled={sendingEmail} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors">
                    {sendingEmail ? 'Resending...' : 'Resend code'}
                  </button>
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={back} className="flex-1 rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                {emailVerified && (
                  <Button onClick={next} className="flex-1 rounded-xl">
                    Next <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3 — Terms */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <h2 className="font-display text-xl font-bold">Terms & Conditions</h2>
                <p className="text-sm text-muted-foreground mt-1">Please read and accept before continuing</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto leading-relaxed">
                <p className="font-semibold text-foreground">Terms of Service — Alcohol Delivered</p>
                <p>By using Alcohol Delivered, you confirm that you are 21 years of age or older. Arkansas law strictly prohibits the sale and delivery of alcohol to persons under 21. You agree to present valid government-issued ID at checkout and at the time of delivery.</p>
                <p>Alcohol Delivered operates under a valid Arkansas Third-Party Alcohol Delivery Permit. All deliveries are GPS-tracked and restricted to legal wet counties within Jefferson County, AR. Deliveries occur only during legal hours as defined by the Arkansas Alcoholic Beverage Control Division.</p>
                <p>You agree not to purchase alcohol for anyone under 21. Misrepresentation of age is a criminal offense under Arkansas law. Alcohol Delivered reserves the right to refuse service at any time.</p>
                <p>Deliveries may be refused if the recipient appears intoxicated, cannot present valid ID, or is not the person who placed the order. No refunds will be issued in cases of refused delivery due to compliance reasons.</p>
                <p>You agree that your order location and delivery address may be used for compliance and legal reporting purposes.</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox id="terms" checked={form.terms_accepted} onCheckedChange={v => update('terms_accepted', v)} className="mt-0.5" />
                  <label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                    I am 21 years of age or older and I agree to the <span className="text-primary font-medium">Terms of Service</span> and <span className="text-primary font-medium">Alcohol Delivery Policy</span>.
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox id="privacy" checked={form.privacy_accepted} onCheckedChange={v => update('privacy_accepted', v)} className="mt-0.5" />
                  <label htmlFor="privacy" className="text-sm cursor-pointer leading-relaxed">
                    I agree to the <span className="text-primary font-medium">Privacy Policy</span> and consent to GPS location tracking during delivery for compliance purposes.
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Favorite Brands */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <Star className="w-8 h-8 text-secondary mx-auto mb-2" />
                <h2 className="font-display text-xl font-bold">Favorite Brands</h2>
                <p className="text-sm text-muted-foreground mt-1">Select your go-to brands for personalized recommendations</p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {SPIRIT_BRANDS.map(brand => (
                  <button
                    key={brand.id}
                    onClick={() => toggleBrand(brand.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all text-sm ${
                      form.favorite_brands.includes(brand.id)
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${form.favorite_brands.includes(brand.id) ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                    <div>
                      <p className="font-medium leading-none">{brand.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{brand.category}</p>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">{form.favorite_brands.length} selected · You can skip this step</p>
            </div>
          )}

          {/* STEP 5 — Store Preference */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <MapPin className="w-8 h-8 text-primary mx-auto mb-2" />
                <h2 className="font-display text-xl font-bold">Preferred Stores</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose your favorite local liquor stores</p>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {stores.map(store => (
                  <button
                    key={store.id}
                    onClick={() => toggleStore(store.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      form.preferred_stores.includes(store.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${form.preferred_stores.includes(store.id) ? 'text-primary' : ''}`}>{store.name}</p>
                      <p className="text-xs text-muted-foreground">{store.address}, {store.city}</p>
                    </div>
                    {form.preferred_stores.includes(store.id) && (
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">{form.preferred_stores.length} selected · You can skip this step</p>
            </div>
          )}

          {/* STEP 6 — App Tracking */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <Smartphone className="w-8 h-8 text-primary mx-auto mb-2" />
                <h2 className="font-display text-xl font-bold">App Tracking</h2>
                <p className="text-sm text-muted-foreground mt-1">Help us improve your experience</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium">Allow tracking across other apps?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Alcohol Delivered would like permission to track your activity across other companies' apps and websites. This helps us show you relevant ads and promotions on other platforms, and improves our recommendations.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your data will <strong>never</strong> be sold. Tracking is only used for improving your experience and relevant promotions. You can change this in your account settings at any time.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => { update('allow_tracking', true); next(); }}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Allow Tracking
                </button>
                <button
                  onClick={() => { update('allow_tracking', false); next(); }}
                  className="w-full py-3 rounded-xl border font-semibold text-sm hover:bg-muted transition-colors"
                >
                  Ask App Not to Track
                </button>
              </div>
            </div>
          )}

          {/* STEP 7 — Free Trial */}
          {step === 7 && (
            <div className="space-y-5 text-center">
              <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto">
                <Gift className="w-10 h-10 text-secondary" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold">🎉 You're In!</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Welcome, {form.first_name}! Your free trial is ready to start. Enjoy full access for <strong>30 days — completely free</strong>.
                </p>
              </div>

              {/* Referral code entry */}
              {!referralApplied && (
                <div className="bg-muted/50 border rounded-xl p-4 text-left space-y-2">
                  <p className="text-sm font-semibold">Have a referral code? (optional)</p>
                  <div className="flex gap-2">
                    <input
                      value={form.referral_code}
                      onChange={e => update('referral_code', e.target.value.toUpperCase())}
                      placeholder="e.g. JOHN4X2K"
                      className="flex-1 h-9 rounded-lg border border-input bg-white px-3 text-sm font-mono tracking-widest"
                      maxLength={10}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={applyReferral}
                      disabled={!form.referral_code || applyingReferral}
                      className="h-9"
                    >
                      {applyingReferral ? 'Applying...' : 'Apply'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">You'll get $3.00 credit + 30 loyalty points!</p>
                </div>
              )}
              {referralApplied && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800 font-medium">
                  ✅ Referral applied — $3.00 credit added to your account!
                </div>
              )}

              <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-5 text-left space-y-3">
                <p className="font-semibold text-secondary flex items-center gap-2"><Gift className="w-4 h-4" /> What's included in your free 30 days:</p>
                {[
                  'Unlimited deliveries from licensed Pine Bluff stores',
                  'Priority access to all 36+ local retailers',
                  'Real-time GPS order tracking',
                  'No delivery fee for your first 3 orders',
                  'Personalized recommendations based on your brands',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-primary">After your free trial</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Just $10.00/month — cancel anytime</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-display font-bold text-primary">$10</p>
                  <p className="text-xs text-muted-foreground">/month</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
                Free trial valid for 30 days. No credit card required to start. After 30 days, continue for only $10.00/month. Cancel anytime. By starting your trial you confirm you are 21+ and agree to our Terms of Service.
                <span className="block mt-1">To cancel your membership, email us at <a href="mailto:jpbsandiego@yahoo.com" className="text-primary hover:underline">jpbsandiego@yahoo.com</a>.</span>
              </div>
              <Button onClick={finish} disabled={loading} className="w-full h-12 text-base rounded-xl" size="lg">
                {loading ? 'Setting up your account...' : 'Start My Free 30 Days →'}
              </Button>
              <button onClick={back} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Go back
              </button>
            </div>
          )}

          {/* Navigation (not shown on step 2, 6, 7 which have their own buttons) */}
          {step !== 2 && step !== 6 && step !== 7 && (
            <div className="flex gap-3 mt-6">
              {step > 1 && (
                <Button variant="outline" onClick={back} className="flex-1 rounded-xl">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              )}
              <Button onClick={next} className="flex-1 rounded-xl">
                {step === 4 || step === 5 ? 'Continue' : 'Next'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Step {step} of {TOTAL_STEPS} · Already have an account?{' '}
          <button onClick={() => navigate('/stores')} className="text-primary hover:underline">Skip to app</button>
        </p>
      </div>
    </div>
  );
}