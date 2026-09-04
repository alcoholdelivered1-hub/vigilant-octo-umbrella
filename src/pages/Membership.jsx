import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, Calendar, Sparkles, Truck, Tag, Zap, Gift, Star } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { isMobileApp } from '@/lib/isMobileApp';

export default function Membership() {
  const [loading, setLoading] = useState(false);
  const inMobileApp = isMobileApp();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(u => setUser(u))
      .catch(() => {})
      .finally(() => setUserLoading(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get('subscription') === 'success') {
      toast.success('Your 30-day free trial has started!');
    } else if (params.get('subscription') === 'cancelled') {
      toast.info('Subscription checkout was cancelled.');
    }
  }, []);

  const handleSubscribe = async () => {
    // No Stripe purchase path inside the native mobile app (App Store / Play
    // policy requires native IAP for digital subscriptions, which Base44 does
    // not yet expose). Checkout is only offered on the web app.
    if (inMobileApp) {
      toast.info('Subscriptions are managed on our website. Open alcoholdelivered.com in your browser to start your free trial.');
      return;
    }
    // Stripe Checkout cannot run inside an iframe
    if (window.self !== window.top) {
      toast.error('Checkout requires the full app — please open in a new tab.');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('createStripeSubscriptionCheckout', {});
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.data?.error || 'Failed to start checkout');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  const membershipStatus = user?.membership_status || 'none';
  const isActive = membershipStatus === 'active' || membershipStatus === 'trialing';
  const expiresAt = user?.membership_expires_at;

  const perks = [
    { icon: Truck, title: '$4.75 delivery, every order', desc: 'Members always get the flat $4.75 delivery fee on every order, any day.' },
    { icon: Tag, title: 'Exclusive member deals', desc: 'Unlock member-only discounts and promo pricing on featured items.' },
    { icon: Zap, title: 'Priority dispatch', desc: 'Your orders jump the queue and get matched to a driver first.' },
    { icon: Star, title: 'Early access', desc: 'Be first to shop new products and limited releases before they sell out.' },
    { icon: Gift, title: '2× loyalty points', desc: 'Earn double rewards points on every purchase to redeem faster.' },
  ];

  const steps = [
    { n: '1', title: 'Start your free trial', desc: 'Tap below to begin your 30-day free trial — no charge today.' },
    { n: '2', title: 'Enjoy member benefits', desc: 'Order as usual and your member perks apply automatically at checkout.' },
    { n: '3', title: 'Stay or cancel anytime', desc: 'After the trial it’s $10/month. Cancel in one click — no commitment.' },
  ];

  const faqs = [
    { q: 'Is there really no charge for the trial?', a: 'Correct — your first 30 days are completely free. You won’t be billed until the trial ends, and you can cancel before then at no cost.' },
    { q: 'How much is it after the trial?', a: 'Membership is $10 per month, billed automatically to your card on file. You can cancel anytime from your profile.' },
    { q: 'Can I cancel anytime?', a: 'Yes. Cancel in one click whenever you like — no phone calls, no hassle. You’ll keep your benefits through the end of the billing period.' },
    { q: 'Do my benefits apply to every order?', a: 'Yes. Free delivery, priority dispatch, and 2× loyalty points apply to every order you place while your membership is active.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background pb-16">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Crown className="w-12 h-12 mx-auto mb-3 text-secondary" />
          <h1 className="font-display text-3xl sm:text-4xl font-bold">Alcohol Delivered Membership</h1>
          <p className="text-primary-foreground/80 mt-3 text-sm sm:text-base max-w-lg mx-auto">
            One subscription, premium perks, zero hassle. Save on delivery, get exclusive deals, and have your orders prioritized — every single time.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-6 space-y-8">
        {/* Current Status */}
        {!userLoading && isActive && (
          <Card className="p-5 border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-emerald-900">
                  {membershipStatus === 'trialing' ? 'Free Trial Active' : 'Membership Active'}
                </p>
                {expiresAt && (
                  <p className="text-sm text-emerald-700 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Renews on {format(new Date(expiresAt), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
              <Badge className="bg-emerald-500 text-white capitalize">{membershipStatus}</Badge>
            </div>
          </Card>
        )}

        {/* Plan Card */}
        <Card className="overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-secondary" />
            <h2 className="font-display text-2xl font-bold">Premium Membership</h2>
            <div className="mt-3 flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">$10</span>
              <span className="text-primary-foreground/70">/month</span>
            </div>
            <p className="text-secondary text-sm font-medium mt-1">30-day free trial — no charge today</p>
          </div>

          <div className="p-6">
            <ul className="space-y-4 mb-6">
              {perks.map((perk, i) => {
                const Icon = perk.icon;
                return (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">{perk.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{perk.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {userLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : isActive ? (
              <div className="text-center text-sm text-muted-foreground py-3">
                You're all set! Your membership benefits are active.
              </div>
            ) : inMobileApp ? (
              <div className="text-center py-3 px-4 rounded-lg bg-muted text-sm text-muted-foreground">
                Membership is $10/month with a 30-day free trial. To start or
                manage your subscription, open <span className="font-medium text-foreground">alcoholdelivered.com</span> in your browser.
              </div>
            ) : (
              <Button
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full h-12 text-base font-semibold gap-2"
                size="lg"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Starting checkout...</>
                ) : (
                  <><Crown className="w-5 h-5" /> Start Free Trial</>
                )}
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center mt-4">
              Cancel anytime. After your 30-day free trial, you'll be charged $10/month.
              No commitment — manage your subscription from your profile.
            </p>
          </div>
        </Card>

        {/* How it works */}
        <div>
          <h3 className="font-display text-xl font-bold text-center mb-5">How it works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {steps.map((s, i) => (
              <Card key={i} className="p-4 text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center mx-auto mb-2">
                  {s.n}
                </div>
                <p className="font-medium text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h3 className="font-display text-xl font-bold text-center mb-5">Frequently asked questions</h3>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <Card key={i} className="p-4">
                <p className="font-medium text-sm text-foreground">{f.q}</p>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}