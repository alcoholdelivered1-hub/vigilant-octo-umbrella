import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Wine, Car, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function LandingSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', city: '', role: 'customer' });
  const [ageChecked, setAgeChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.phone) {
      toast.error('Please fill in your name, email, and phone.');
      return;
    }
    if (!ageChecked) {
      toast.error('Please confirm you are 21 or older.');
      return;
    }
    // Drivers need the full multi-step form to capture required details
    // (DOB, gig experience, vehicle, license). Redirect there instead of
    // creating a partial record with missing driver details.
    if (form.role === 'driver') {
      navigate('/early-signup');
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.EarlySignup.create({
        role: form.role,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        age_verified: true,
        status: 'pending',
      });
      setDone(true);
      toast.success("You're on the list! We'll be in touch soon.");
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <section className="py-24 bg-gradient-to-br from-primary to-[hsl(234,62%,12%)]">
        <div className="max-w-lg mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="w-20 h-20 rounded-full bg-secondary/20 border border-secondary/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-secondary" />
          </motion.div>
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-3">You're In! 🎉</h2>
          <p className="text-primary-foreground/70 mb-8">
            Thanks for signing up{form.city ? `, we'll notify you when we launch in ${form.city}` : ''}.
            Check your inbox for a welcome email from Alcohol Delivered by SipSwift.
          </p>
          <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground" asChild>
            <a href="/stores">Browse Stores <ArrowRight className="w-4 h-4 ml-2" /></a>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 bg-muted/40 border-y">
      <div className="max-w-3xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="text-center mb-10">
          <span className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/30 text-secondary rounded-full px-4 py-1.5 text-sm font-semibold mb-4">
            <Wine className="w-3.5 h-3.5" /> Join Alcohol Delivered by SipSwift
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold">Get Early Access</h2>
          <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
            Sign up now for a free 30-day trial with Alcohol Delivered by SipSwift. No commitment — just great drinks delivered to your door.
          </p>
        </motion.div>

        <motion.form initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          onSubmit={handleSubmit}
          className="bg-card rounded-2xl border shadow-lg p-6 md:p-8 space-y-5">

          {/* Role toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => update('role', 'customer')}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                form.role === 'customer'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40 text-muted-foreground'
              }`}>
              <Wine className="w-4 h-4" /> I want to order
            </button>
            <button
              type="button"
              onClick={() => update('role', 'driver')}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                form.role === 'driver'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40 text-muted-foreground'
              }`}>
              <Car className="w-4 h-4" /> I want to drive
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="su-name">Full Name *</Label>
              <Input id="su-name" value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-phone">Phone *</Label>
              <Input id="su-phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="(870) 555-0123" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="su-email">Email *</Label>
              <Input id="su-email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="su-city">City</Label>
              <Input id="su-city" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Pine Bluff" />
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={ageChecked} onChange={e => setAgeChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-input accent-primary" />
            <span className="text-sm text-muted-foreground leading-relaxed">
              I confirm that I am <strong className="text-foreground">21 years of age or older</strong> and agree to be contacted about Alcohol Delivered by SipSwift.
            </span>
          </label>

          <Button type="submit" disabled={submitting} className="w-full h-12 text-base rounded-xl gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing up...</> : <>Sign Up Free <ArrowRight className="w-4 h-4" /></>}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Free 30-day trial · No credit card required · Cancel anytime
          </p>
        </motion.form>
      </div>
    </section>
  );
}