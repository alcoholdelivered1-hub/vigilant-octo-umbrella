import React from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Truck, TrendingUp, Clock, BadgeCheck,
  Wine, Printer, ArrowRight, Store, Copy,
} from 'lucide-react';
import { toast } from 'sonner';

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: 'Prevents drunk driving',
    body: "Customers who've been drinking order to their door instead of getting behind the wheel. Every delivery is one fewer impaired driver on Arkansas roads.",
  },
  {
    icon: TrendingUp,
    title: 'New revenue, zero effort',
    body: 'Reach customers who never walk your aisles. You keep 100% of product sales — we earn only a service and delivery fee.',
  },
  {
    icon: Truck,
    title: 'We handle the delivery',
    body: 'Background-checked, trained drivers. Live GPS tracking. ID verification at the door. You never touch a delivery.',
  },
  {
    icon: Clock,
    title: 'Live in days, not months',
    body: 'Your existing Clover inventory syncs automatically. Stripe payments are wired straight to your account. No new hardware, no new staff.',
  },
];

const STEPS = [
  'Sign up (2 minutes — license + contact info)',
  'We verify your Arkansas ABC license',
  'Connect Clover + Stripe (one click each)',
  'Go live and start receiving orders',
];

const PITCH_TEXT = `Alcohol Delivered — Arkansas' licensed-retailer delivery platform.

Why it matters: when a customer who's been drinking can order to their door, they don't drive to the store — and they don't drive back. Every delivery is one fewer impaired driver on the road. Your store becomes part of the solution.

What you get:
• New revenue from customers who never walk your aisles
• You keep 100% of product sales — we earn only a service + delivery fee
• Background-checked, trained drivers with live GPS + ID verification at the door
• Your existing Clover inventory syncs automatically
• Stripe payments wired straight to your account — no new hardware, no new staff
• Live in days, not months

How little you do:
1. Sign up (2 minutes — license + contact info)
2. We verify your Arkansas ABC license
3. Connect Clover + Stripe (one click each)
4. Go live and start receiving orders

Beverage King (Pine Bluff) is live now — proof the model works end-to-end for an independent retailer just like yours.

Join at no cost: alcohol.delivered1@gmail.com · Pine Bluff, Arkansas`;

const FB_AD_COPY = `🚗 Don't drive. We'll bring it to you.

Alcohol Delivered gets your favorite drinks to your door in under an hour — so you never have to get behind the wheel after drinking.

✅ Licensed Arkansas retailers
✅ Background-checked, trained drivers
✅ ID verified at delivery
✅ Live order tracking

Order tonight, or become a retail partner and grow your sales — no new staff, no delivery logistics.

👉 Tap to order or sign up your store.`;

export default function RetailerPitch() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="max-w-3xl mx-auto px-4 py-6 print:py-2">

        {/* Top bar */}
        <div className="flex items-center justify-between print:hidden">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            ← Back to app
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print / Save PDF
          </Button>
        </div>

        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden mt-3 print:shadow-none print:border-0">

          {/* Hero */}
          <div className="bg-primary text-primary-foreground px-6 py-8 print:px-5">
            <div className="flex items-center gap-2 mb-3">
              <Wine className="w-6 h-6" />
              <span className="font-display font-bold text-lg">Alcohol Delivered</span>
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight">
              Grow sales. Protect your community.
            </h1>
            <p className="mt-3 text-primary-foreground/90 text-sm leading-relaxed max-w-xl">
              The licensed-retailer delivery platform for Arkansas. Join at no cost,
              keep every product dollar, and help keep drunk drivers off the road.
            </p>
          </div>

          <div className="p-6 print:p-5 space-y-6">

            {/* The mission */}
            <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-4">
              <p className="text-sm leading-relaxed text-foreground">
                <strong className="text-secondary">Why this matters:</strong> Nearly a third of
                traffic deaths involve an alcohol-impaired driver. When a customer who's been
                drinking can order to their door, they don't drive to the store — and they
                don't drive back. Your store becomes part of the solution.
              </p>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BENEFITS.map((b) => (
                <div key={b.title} className="rounded-xl border p-4">
                  <b.icon className="w-5 h-5 text-primary mb-2" />
                  <h3 className="font-semibold text-sm">{b.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{b.body}</p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div>
              <h2 className="font-display text-lg font-bold mb-3">How little you do</h2>
              <ol className="space-y-2">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Proof point */}
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <BadgeCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Pilot store live now:</strong> Beverage King
                (Pine Bluff) is onboarded with Clover inventory sync and Stripe payouts — proof the
                model works end-to-end for an independent retailer just like yours.
              </p>
            </div>

            {/* Facebook ad */}
            <div className="border-t pt-5">
              <h2 className="font-display text-lg font-bold mb-3">Facebook ad creative</h2>
              <img
                src="https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/66e2fc1ec_generated_image.png"
                alt="Alcohol delivery driver handing a bag to a customer at the door"
                className="w-full rounded-xl border mb-3"
              />
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-muted-foreground">Ad copy</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(FB_AD_COPY);
                      toast.success('Ad copy copied to clipboard');
                    } catch {
                      toast.error('Copy failed — select the text and copy manually');
                    }
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy ad copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground bg-muted/40 rounded-xl p-4 border select-all">
{FB_AD_COPY}
              </pre>
              <p className="text-[11px] text-muted-foreground mt-2">
                Tip: Save the image above, paste the copy into Facebook Ads Manager as a single-image
                ad, and target adults 21+ in your delivery area.
              </p>
            </div>

            {/* Copy/paste version */}
            <div className="border-t pt-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-bold">Copy / paste version</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(PITCH_TEXT);
                      toast.success('Pitch copied to clipboard');
                    } catch {
                      toast.error('Copy failed — select the text and copy manually');
                    }
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy text
                </Button>
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground bg-muted/40 rounded-xl p-4 border select-all">
{PITCH_TEXT}
              </pre>
            </div>

            {/* CTA */}
            <div className="border-t pt-5 flex flex-col sm:flex-row items-center gap-3 justify-between print:hidden">
              <div className="text-sm text-muted-foreground">
                Ready to join? Sign up in two minutes.
              </div>
              <Link to="/retailer-signup">
                <Button className="h-11 rounded-xl">
                  <Store className="w-4 h-4 mr-2" /> Become a Retail Partner
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>

            <p className="text-center text-xs text-muted-foreground pt-2">
              Questions? alcohol.delivered1@gmail.com · Pine Bluff, Arkansas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}