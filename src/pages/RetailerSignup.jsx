import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import RetailerDirectContact from '@/components/partner/RetailerDirectContact';
import ExistingApplicationNotice from '@/components/partner/ExistingApplicationNotice';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Store, CheckCircle2, Loader2, ShieldCheck, ArrowLeft, Wine } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ARKANSAS_COUNTIES } from '@/lib/arkansasCounties';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BUSINESS_TYPES = [
  { value: 'liquor_store', label: 'Liquor Store' },
  { value: 'wine_spirits', label: 'Wine & Spirits' },
  { value: 'convenience', label: 'Convenience Store' },
  { value: 'grocery', label: 'Grocery Store' },
  { value: 'restaurant_bar', label: 'Restaurant / Bar' },
  { value: 'other', label: 'Other' },
];

export default function RetailerSignup() {
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState(0);
  const share = async () => {
    const url = new URL('/retailer-signup', window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: 'Alcohol Delivered | Retail Partners', text: 'Your store. More doorsteps. Become an Alcohol Delivered retail partner.', url });
      else { await navigator.clipboard.writeText(url); toast.success('Retailer signup link copied'); }
    } catch (error) { if (error.name !== 'AbortError') toast.error('Copy the address from your browser to share.'); }
  };
  const next = () => {
    if (step === 0 && !form.business_type) return toast.error('Choose your business type to continue.');
    if (step === 1) {
      if (!form.store_name.trim()) return toast.error('Enter your store name to continue.');
      if (!form.address.trim()) return toast.error('Enter your store’s street address.');
      if (!form.city.trim()) return toast.error('Enter your city.');
      if (!/^\d{5}(-\d{4})?$/.test(form.zip_code.trim())) return toast.error('Enter a valid 5-digit ZIP code.');
      if (!form.state.trim()) return toast.error('Enter your state.');
      if (!form.county) return toast.error('Select the county where your store is located.');
      if (!form.license_number.trim()) return toast.error('Enter your ABC retail license number.');
    }
    setStep(s => Math.min(2, s + 1));
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateApplication, setDuplicateApplication] = useState(null);
  const [ownApplication, setOwnApplication] = useState(null);
  const [form, setForm] = useState({
    store_name: '', address: '', city: '', state: 'AR', zip_code: '', county: '', license_number: '',
    contact_name: '', contact_email: '', contact_phone: '', business_type: '',
  });

  const update = (k, value) => setForm(prev => ({ ...prev, [k]: value }));

  // A signed-in returning applicant is shown their own existing application.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!(await base44.auth.isAuthenticated())) return;
        const { data } = await base44.functions.invoke('submitRetailerSignup', { action: 'myApplication' });
        if (active && data?.application) setOwnApplication(data.application);
      } catch {
        // Anonymous visitors cannot look one up; the form still works.
      }
    })();
    return () => { active = false; };
  }, []);

  const field = (label, key, placeholder = '', type = 'text', required = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label} {required && <span className="text-destructive">*</span>}</Label>
      <Input id={key} type={type} required={required} autoComplete={key === 'contact_email' ? 'email' : key === 'contact_phone' ? 'tel' : key === 'contact_name' ? 'name' : 'organization'} value={form[key]} onChange={e => update(key, e.target.value)} placeholder={placeholder} />
    </div>
  );

  const handleSubmit = async () => {
    if (!form.store_name.trim() || !form.contact_name.trim() || !form.contact_email.trim()) {
      toast.error('Please fill in store name, contact name, and email.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(form.contact_email)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!form.business_type) {
      toast.error('Please select your business type.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await base44.functions.invoke('submitRetailerSignup', {
        store_name: form.store_name,
        address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        county: form.county,
        license_number: form.license_number,
        contact_name: form.contact_name,
        contact_email: form.contact_email,
        contact_phone: form.contact_phone,
        business_type: form.business_type,
      });
      if (!data || data.error) throw new Error(data?.error || 'We could not save your application.');
      setDuplicateApplication(data.duplicate ? (data.application || { store_name: form.store_name, status: 'pending', created_date: null }) : null);
      setSubmitted(true);
    } catch (e) {
      const message = e?.response?.data?.error || e?.message || 'Something went wrong. Please try again.';
      setError(message);
      toast.error(message);
    }
    setLoading(false);
  };

  if (submitted) return (
    <PageShell>
      <div className="text-center space-y-5 py-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">{duplicateApplication ? 'Application Already Submitted' : 'Application Received!'}</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {duplicateApplication
              ? <>No second application was created. We will review the application we already have and reach out to <strong>{form.contact_email}</strong>.</>
              : <>Thank you, <strong>{form.contact_name.split(' ')[0]}</strong>! We'll review your application and reach out to <strong>{form.contact_email}</strong> to link your store and start setup. This application is saved; it does not open customer ordering.</>}
          </p>
          {!duplicateApplication && form.county && <p className="text-sm text-muted-foreground">Saved location: {[form.address, form.city, form.county + ' County', form.state, form.zip_code].filter(Boolean).join(', ')}. Your county is reviewed before delivery setup.</p>}
        </div>
        {duplicateApplication ? <ExistingApplicationNotice application={duplicateApplication} /> : <>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-left text-sm space-y-2">
            <p className="font-semibold text-primary flex items-center gap-2"><Store className="w-4 h-4" /> What happens next:</p>
            <p className="text-muted-foreground">1. We review your details and verify your license.</p>
            <p className="text-muted-foreground">2. We send you a partner agreement to sign.</p>
            <p className="text-muted-foreground">3. We set up payments, inventory, and delivery.</p>
            <p className="text-muted-foreground">4. You go live and start receiving orders.</p>
          </div>
          <Button asChild variant="outline" className="w-full"><Link to="/onboarding">Open saved store setup</Link></Button><RetailerDirectContact />
        </>}
        <p className="text-xs text-muted-foreground">Questions? Email <a href="mailto:alcohol.delivered1@gmail.com" className="text-primary hover:underline">alcohol.delivered1@gmail.com</a></p>
      </div>
    </PageShell>
  );

  return (
    <PageShell>
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Alcohol Delivered • Retail Partners</p>
          <h1 className="font-display text-4xl font-bold leading-tight">Your store.<br /><span className="text-primary">More doorsteps.</span></h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You stock the shelves. We help bring your store to customers’ doors. Start your retailer application below.
          </p>
        </div>

        {ownApplication
          ? <ExistingApplicationNotice application={ownApplication} />
          : <div className="rounded-xl border bg-muted/30 p-4 space-y-2"><p className="font-semibold text-sm">Already working with Alcohol Delivered?</p><p className="text-sm text-muted-foreground">Resume your saved setup. You do not need to submit another application.</p><Button asChild variant="outline" className="w-full"><Link to="/onboarding">Continue existing store setup</Link></Button></div>}

        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 text-xs text-secondary flex items-center gap-2">
          <Wine className="w-4 h-4 shrink-0" />
          <span><strong>Your store. Your products. Our delivery partnership.</strong> Fees and terms are confirmed in your retailer agreement.</span>
        </div>

        <div className="flex gap-2" aria-label="Application progress">
          {['Business type', 'Your store', 'Contact details'].map((title, i) => <div key={title} className="flex-1">
            <div className={cn('h-1.5 rounded-full mb-2', i <= step ? 'bg-emerald-500' : 'bg-muted')} />
            <p className={cn('text-xs', i === step ? 'font-bold text-foreground' : 'text-muted-foreground')}>{i < step ? '✓' : i + 1} {title}</p>
          </div>)}
        </div>
        <p className="text-sm font-semibold" aria-live="polite">Step {step + 1} of 3 — {['Choose your business', 'Where is your store?', 'How can we reach you?'][step]}</p>
        <div className="space-y-3">
          {step === 1 && <>
            {field('Store / Business Name', 'store_name', 'Your store name', 'text', true)}
            {field('Street Address', 'address', '123 Main St', 'text', true)}
            <div className="grid grid-cols-2 gap-3">
              {field('City', 'city', 'Pine Bluff', 'text', true)}
              {field('ZIP Code', 'zip_code', '71601', 'text', true)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field('State', 'state', 'AR', 'text', true)}
              <div className="space-y-1.5">
                <Label htmlFor="county">County <span className="text-destructive">*</span></Label>
                <Select value={form.county || undefined} onValueChange={value => update('county', value)}>
                  <SelectTrigger id="county" className="min-h-11 w-full"><SelectValue placeholder="Select county" /></SelectTrigger>
                  <SelectContent>
                    {ARKANSAS_COUNTIES.map(county => <SelectItem key={county} value={county}>{county}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {field('ABC Retail License Number', 'license_number', 'Your Arkansas ABC license', 'text', true)}
          </>}
          {step === 2 && <>
            {field('Your Name', 'contact_name', 'Your full name', 'text', true)}
            {field('Email', 'contact_email', 'store@example.com', 'email', true)}
            {field('Phone', 'contact_phone', '(870) 555-0100', 'tel')}
          </>}
          {step === 0 && <div className="space-y-1.5">
            <Label>Business Type <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {BUSINESS_TYPES.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={form.business_type === opt.value}
                  onClick={() => update('business_type', opt.value)}
                  className={cn(
                    'text-sm px-3 py-2.5 rounded-xl border-2 text-left font-medium transition-all',
                    form.business_type === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50 text-muted-foreground'
                  )}
                >
                  {form.business_type === opt.value ? '✓ ' : ''}{opt.label}
                </button>
              ))}
            </div>
          </div>}
        </div>

        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span>By submitting, you confirm you're an authorized representative. We'll verify your license and collect the rest of your details during onboarding.</span>
        </div>

        {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {step > 0 && <Button variant="outline" disabled={loading} onClick={() => setStep(s => s - 1)} className="w-full">Previous step</Button>}
        {step < 2 ? <Button onClick={next} className="w-full h-12 rounded-xl text-base">Continue →</Button> : <Button onClick={handleSubmit} disabled={loading} className="w-full h-12 rounded-xl text-base">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Submitting…</>
            : <><CheckCircle2 className="w-4 h-4 mr-2" /> Submit Application</>
          }
        </Button>}
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm text-muted-foreground">Application review comes first. Store setup and launch approval follow.</p>
          <a className="block text-center font-semibold text-primary py-2" href="tel:+18707181521">Need a hand? Call John • 870-718-1521</a>
          <Button onClick={share} variant="outline" className="w-full">Share this retailer invitation ↗</Button>
          <details className="text-sm rounded-xl border p-3"><summary className="cursor-pointer font-semibold">What happens after I apply?</summary><p className="mt-2 text-muted-foreground">We review your details, verify eligibility, and help with your agreement, payments, catalog, and store setup. Watch your inbox and spam folder for follow-up. Submitting does not activate ordering.</p></details>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4 py-10">
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-center justify-between">
          <button onClick={() => window.history.back()} className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Back
          </button>
          <img
            src="https://api.logo.com/api/v2/images?design=lg_Too7fQP2y0FX4csPSa&format=webp&width=400&height=400&fit=contain&quality=100&margins=50&u=e8990f4804f353fd89d3ea2d9fb192ea9342d7357e72b4fe8a99b08584763c"
            alt="Alcohol Delivered"
            className="h-14 w-20 object-fill"
          />
        </div>
        <div className="bg-card rounded-3xl border border-emerald-500/30 shadow-2xl p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}