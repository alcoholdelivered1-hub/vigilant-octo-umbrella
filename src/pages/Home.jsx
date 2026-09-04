import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, MapPin, Truck, Clock, Wine, ArrowRight, CheckCircle2, Zap, Star, Phone } from 'lucide-react';
import AgeGate from '@/components/shared/AgeGate';
import LandingSignup from '@/components/shared/LandingSignup';
import { motion, useScroll, useTransform } from 'framer-motion';

const features = [
  { icon: ShieldCheck, title: 'Age Verified', desc: 'Strict 21+ verification at checkout and delivery per Arkansas ABC.' },
  { icon: MapPin,      title: 'Geo-Verified',   desc: 'GPS-tracked deliveries within legal wet counties only.' },
  { icon: Truck,       title: 'Licensed Drivers',desc: 'Every driver is 21+ and trained in AR alcohol delivery law.' },
  { icon: Clock,       title: 'Legal Hours',     desc: 'We only deliver during legally permitted sale hours in your area.' },
];

const steps = [
  { num: '01', title: 'Browse Stores',    desc: 'Pick from licensed retailers near you' },
  { num: '02', title: 'Verify Your Age',  desc: 'Upload a valid government-issued ID' },
  { num: '03', title: 'Place Your Order', desc: 'Secure checkout with zone verification' },
  { num: '04', title: 'Door Delivery',    desc: 'ID verified again at your door' },
];

const badges = ['21+ Verified', 'GPS Tracked', 'Licensed Retailers', 'Legal Hours Only', 'AR ABC Compliant'];

function CountUp({ target, duration = 1800 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count}</>;
}

export default function Home() {
  const [ageVerified, setAgeVerified] = useState(() => localStorage.getItem('age_verified') === 'true');

  const handleAgeVerified = () => {
    setAgeVerified(true);
    localStorage.setItem('age_verified', 'true');
  };

  if (!ageVerified) return <AgeGate onVerified={handleAgeVerified} />;

  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-[hsl(234,62%,12%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_40%,hsl(38,92%,50%,0.18),transparent)]" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(hsl(0,0%,100%) 1px,transparent 1px),linear-gradient(90deg,hsl(0,0%,100%) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Floating orbs */}
        <motion.div animate={{ y: [0, -24, 0], rotate: [0, 8, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-24 right-16 w-72 h-72 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
        <motion.div animate={{ y: [0, 20, 0], rotate: [0, -6, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-32 left-8 w-48 h-48 rounded-full bg-primary-foreground/5 blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 py-24 w-full">
          <div className="max-w-3xl">
            {/* Launch badge */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 bg-secondary/20 border border-secondary/40 text-secondary rounded-full px-4 py-1.5 text-sm font-semibold mb-7 backdrop-blur-sm">
                <Zap className="w-3.5 h-3.5 fill-secondary" />
                Now Live in Pine Bluff, AR
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
              className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] text-primary-foreground">
              Your Favorite{' '}
              <span className="relative inline-block">
                <span className="text-secondary">Spirits</span>
                <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.8 }}
                  className="absolute -bottom-1 left-0 right-0 h-1 bg-secondary/50 rounded-full origin-left" />
              </span>
              <br />Delivered to Your Door.
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
              className="text-lg text-primary-foreground/70 mt-6 leading-relaxed max-w-xl">
              Legal, age-verified alcohol delivery from licensed Arkansas retailers —
              GPS-tracked and fully compliant with all ABC state regulations.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.45 }}
              className="flex flex-wrap gap-3 mt-10">
              <Link to="/stores">
                <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-base px-8 h-13 rounded-xl shadow-lg shadow-secondary/30 gap-2">
                  Order Now <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base px-7 h-13 rounded-xl backdrop-blur-sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/track">
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base px-7 h-13 rounded-xl backdrop-blur-sm">
                  Track My Order
                </Button>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-2 mt-10">
              {badges.map(b => (
                <span key={b} className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground/60 bg-primary-foreground/5 border border-primary-foreground/10 rounded-full px-3 py-1">
                  <CheckCircle2 className="w-3 h-3 text-secondary" />{b}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}
            className="grid grid-cols-3 gap-4 mt-20 max-w-lg">
            {[
              { value: 5, suffix: '+', label: 'Partner Stores' },
              { value: 21, suffix: '+', label: 'Min Age Required' },
              { value: 100, suffix: '%', label: 'ID Verified' },
            ].map((s, i) => (
              <div key={i} className="text-center bg-primary-foreground/5 border border-primary-foreground/10 rounded-2xl py-4 backdrop-blur-sm">
                <p className="font-display text-3xl font-bold text-secondary">
                  <CountUp target={s.value} duration={1400 + i * 200} />{s.suffix}
                </p>
                <p className="text-xs text-primary-foreground/50 mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-primary-foreground/30">
          <div className="w-5 h-8 border-2 border-current rounded-full flex items-start justify-center pt-1.5">
            <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }}
              className="w-1 h-1.5 rounded-full bg-current" />
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built for Compliance. Built for You.</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Every delivery is designed around Arkansas law and your safety.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="group bg-card border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-base">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 bg-muted/40 border-y">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold">How It Works</h2>
            <p className="text-muted-foreground mt-3">Four simple steps to legal alcohol delivery</p>
          </motion.div>
          <div className="relative grid md:grid-cols-4 gap-8">
            {/* Connector line */}
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            {steps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
                className="flex flex-col items-center text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-card border-2 border-primary/20 flex items-center justify-center mb-4 shadow-sm relative z-10">
                  <span className="font-display font-bold text-xl text-secondary">{step.num}</span>
                </div>
                <h3 className="font-semibold text-base">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5">{step.desc}</p>
              </motion.div>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.5 }}
            className="flex justify-center mt-14">
            <Link to="/stores">
              <Button size="lg" className="text-base px-10 h-13 rounded-xl gap-2 shadow-md">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── SIGNUP FORM ── */}
      <LandingSignup />

      {/* ── COMPLIANCE CTA ── */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[hsl(234,62%,15%)] p-10 md:p-14 text-primary-foreground">
            <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1">
                <span className="text-secondary text-sm font-semibold uppercase tracking-widest">Fully Licensed</span>
                <h2 className="font-display text-3xl md:text-4xl font-bold mt-2">Delivery You Can Trust</h2>
                <p className="mt-4 text-primary-foreground/75 leading-relaxed max-w-lg">
                  Operating under a valid Arkansas Third-Party Alcohol Delivery Permit.
                  Every delivery is GPS-tracked, age-verified, and within legal zones.
                </p>
                <div className="flex flex-wrap gap-2 mt-6">
                  {['21+ Verified', 'GPS Tracked', 'Licensed Retailers', 'Legal Hours'].map(item => (
                    <span key={item} className="flex items-center gap-1.5 text-xs bg-primary-foreground/10 border border-primary-foreground/20 rounded-full px-3 py-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-4">
                <div className="w-28 h-28 rounded-3xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
                  <Wine className="w-14 h-14 text-secondary" />
                </div>
                <a href="tel:8702099109">
                  <Button variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 gap-2">
                    <Phone className="w-4 h-4" /> 870-209-9109
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-10 bg-card">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Wine className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-lg">Alcohol Delivered <span className="text-secondary">by SipSwift</span></span>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              © 2026 Alcohol Delivered, LLC · Pine Bluff, AR · Licensed under Arkansas ABC · Must be 21+ · Drink responsibly.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
              AR Third-Party Delivery Permit
            </div>
          </div>
          <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground border-t pt-4">
            <Link to="/legal" className="hover:text-primary transition-colors">Legal Documents</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to="/retailer-contract" className="hover:text-primary transition-colors">Retailer Agreement</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}