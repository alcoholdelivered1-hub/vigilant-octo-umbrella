import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DollarSign, Clock, Car, ShieldCheck, Award, Zap, TrendingUp,
  CheckCircle2, ArrowRight, MapPin, Star, Wallet, Users
} from 'lucide-react';

const PERKS = [
  { icon: DollarSign, title: 'Keep 100% of Tips', desc: 'Every dollar in tips goes straight to your pocket — we never take a cut.' },
  { icon: TrendingUp, title: '$1/Mile Bonus', desc: 'Deliveries over 7 miles earn an extra $1 per mile, paid directly to you.' },
  { icon: Clock, title: 'Set Your Own Hours', desc: 'Drive whenever you want. No minimum shifts, no schedules, no bosses.' },
  { icon: Award, title: 'Free ABC Certification', desc: 'Get Arkansas ABC alcohol delivery certification at no cost — a career credential.' },
  { icon: Zap, title: 'Priority Dispatch', desc: 'Top-rated drivers get first dibs on incoming orders.' },
  { icon: Wallet, title: 'Weekly Payouts', desc: 'Fast Stripe transfers every Monday — no waiting weeks for a paycheck.' },
];

const REQUIREMENTS = [
  { label: 'Age 21+', detail: 'Must be 21 or older to handle alcohol deliveries' },
  { label: 'Valid Driver\'s License', detail: 'Clean AR driver\'s license with no recent DUIs' },
  { label: 'Reliable Vehicle', detail: 'Your own car, truck, or SUV in safe working condition' },
  { label: 'Auto Insurance', detail: 'Current and valid auto insurance coverage' },
  { label: 'Clean Background', detail: 'No felony convictions (required under AR ACT 157)' },
  { label: 'Smartphone', detail: 'iPhone or Android to receive orders and navigate' },
];

const STEPS = [
  { n: 1, title: 'Apply Online', desc: 'Fill out the 5-step application with your info, documents, and vehicle details.' },
  { n: 2, title: 'Complete ABC Training', desc: 'Pass our free, in-app alcohol safety certification quiz (takes ~15 min).' },
  { n: 3, title: 'Background Check', detail: 'We run a quick background check — most clear in 1–2 business days.' },
  { n: 4, title: 'Start Delivering', desc: 'Get activated, flip your availability on, and start earning.' },
];

const SERVICE_AREAS = [
  { city: 'Pine Bluff', county: 'Jefferson County' },
  { city: 'Little Rock', county: 'Pulaski County' },
  { city: 'North Little Rock', county: 'Pulaski County' },
  { city: 'Sherwood', county: 'Pulaski County' },
  { city: 'Cabot', county: 'Lonoke County' },
  { city: 'Maumelle', county: 'Pulaski County' },
  { city: 'Stuttgart', county: 'Arkansas County' },
  { city: 'Rison', county: 'Cleveland County' },
];

export default function DriverRecruitment() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-secondary/20 backdrop-blur-sm border border-secondary/30 rounded-full px-4 py-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-sm font-semibold text-secondary-foreground">Now Hiring — No Cap on Positions</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground rounded-full px-4 py-1.5 mb-6 font-bold shadow-lg">
            <span className="text-sm">🍺 Beverage King is LIVE — Orders Rolling In!</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-4">
            Deliver Alcohol.<br />Earn on Your Schedule.
          </h1>
          <p className="text-lg md:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-8 leading-relaxed">
            Join Arkansas's first licensed alcohol delivery platform. $4.75 per delivery + 100% of tips + $1/mile bonuses. Free ABC certification. Weekly payouts.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/driver/signup">
              <Button size="lg" variant="secondary" className="rounded-xl h-12 px-8 text-base font-bold">
                Apply Now <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <a href="#requirements">
              <Button size="lg" variant="outline" className="rounded-xl h-12 px-8 text-base font-semibold bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                View Requirements
              </Button>
            </a>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-primary-foreground/80">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-secondary" /> No startup fees</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-secondary" /> Paid weekly</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-secondary" /> Free training</div>
          </div>
        </div>
      </section>

      {/* Earnings Highlight */}
      <section className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="font-display text-3xl md:text-4xl font-bold text-primary">$4.75</p>
            <p className="text-xs text-muted-foreground mt-1">Per delivery base pay</p>
          </div>
          <div>
            <p className="font-display text-3xl md:text-4xl font-bold text-primary">100%</p>
            <p className="text-xs text-muted-foreground mt-1">Of tips kept by you</p>
          </div>
          <div>
            <p className="font-display text-3xl md:text-4xl font-bold text-primary">+$1</p>
            <p className="text-xs text-muted-foreground mt-1">Per mile over 7 miles</p>
          </div>
          <div>
            <p className="font-display text-3xl md:text-4xl font-bold text-primary">Weekly</p>
            <p className="text-xs text-muted-foreground mt-1">Stripe payouts every Monday</p>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold">Why Drive With Us?</h2>
            <p className="text-muted-foreground mt-2">More than just a delivery gig — a real opportunity.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PERKS.map((perk) => {
              const Icon = perk.icon;
              return (
                <div key={perk.title} className="bg-card border rounded-2xl p-6 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">{perk.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{perk.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section id="requirements" className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 rounded-full px-4 py-1.5 mb-4">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Pre-Qualification Checklist</span>
            </div>
            <h2 className="font-display text-3xl font-bold">Do You Qualify?</h2>
            <p className="text-muted-foreground mt-2">Arkansas ACT 157 sets strict requirements for alcohol delivery drivers.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REQUIREMENTS.map((req) => (
              <div key={req.label} className="bg-card border rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-bold">{req.label}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{req.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/driver/signup">
              <Button size="lg" className="rounded-xl h-12 px-8 text-base font-bold">
                I Qualify — Start Application <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl font-bold">How to Get Started</h2>
            <p className="text-muted-foreground mt-2">From application to first delivery in as little as 2 days.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((step) => (
              <div key={step.n} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 font-display text-2xl font-bold">
                  {step.n}
                </div>
                <h3 className="font-bold mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-16 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-card border rounded-full px-4 py-1.5 mb-4">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">8 Cities & Growing</span>
            </div>
            <h2 className="font-display text-3xl font-bold">Where We Deliver</h2>
            <p className="text-muted-foreground mt-2">We're actively onboarding drivers across Central Arkansas.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SERVICE_AREAS.map((area) => (
              <div key={area.city} className="bg-card border rounded-xl p-4 text-center">
                <p className="font-bold text-sm">{area.city}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{area.county}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial / Trust */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className="w-6 h-6 fill-secondary text-secondary" />
            ))}
          </div>
          <p className="font-display text-2xl md:text-3xl font-medium leading-relaxed mb-6">
            "Flexible hours, fair pay, and the tips are all mine. The ABC certification was free and I got activated in two days. Best gig decision I've made."
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Active Driver</p>
              <p className="text-xs text-muted-foreground">Alcohol Delivered, Central AR</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <Car className="w-12 h-12 mx-auto mb-4 text-secondary" />
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Earning?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-xl mx-auto">
            The application takes about 10 minutes. Get certified, get activated, and start delivering this week.
          </p>
          <Link to="/driver/signup">
            <Button size="lg" variant="secondary" className="rounded-xl h-14 px-10 text-lg font-bold">
              Apply Now — It's Free <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-xs text-primary-foreground/60 mt-4">
            21+ only · Arkansas residents · No startup fees, ever.
          </p>
        </div>
      </section>
    </div>
  );
}