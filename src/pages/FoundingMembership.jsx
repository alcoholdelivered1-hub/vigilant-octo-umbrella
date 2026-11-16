import React, { useEffect, useState } from 'react';
import { Crown, CheckCircle2, ShieldCheck, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TERMS_VERSION = 'founding-platinum-2026-09-12';

export default function FoundingMembership() {
  const [searchParams] = useSearchParams();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [membership, setMembership] = useState(null);
  const [checking, setChecking] = useState(true);
  const payment = searchParams.get('payment');

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const user = await base44.auth.me();
        const records = await base44.entities.FoundingMembership.filter({
          customer_email: user.email,
          status: 'active',
        });
        if (active) setMembership(records?.[0] || null);
      } catch {
        // Checkout will require sign-in and show the actionable error.
      } finally {
        if (active) setChecking(false);
      }
    };
    check();
    // When returning from a successful payment, keep checking until the webhook
    // creates the membership record.
    let interval;
    if (payment === 'success') {
      interval = setInterval(() => {
        if (active) check();
      }, 3000);
      setTimeout(() => { if (interval) clearInterval(interval); }, 60000);
    }
    return () => { active = false; if (interval) clearInterval(interval); };
  }, [payment]);

  const purchase = async () => {
    if (!accepted) {
      toast.error('Please accept the membership terms first.');
      return;
    }
    setLoading(true);
    try {
      const response = await base44.functions.invoke('createFoundingMembershipCheckout', {
        terms_version: TERMS_VERSION,
      });
      const url = response.data?.url;
      if (!url) throw new Error('Stripe did not return a secure checkout link.');
      window.top.location.href = url;
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Unable to start checkout.');
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-background text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">
        {payment === 'success' && (
          <div className="mb-6 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 p-5 flex gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
            <div>
              <p className="font-semibold">Payment received</p>
              <p className="text-sm text-emerald-100/80">Stripe is confirming your membership. Your Platinum status will appear here after confirmation.</p>
            </div>
          </div>
        )}
        {payment === 'cancelled' && (
          <div className="mb-6 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-5 flex gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0" />
            <p className="text-sm">Checkout was cancelled. You were not charged.</p>
          </div>
        )}

        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-200">
            <Crown className="w-4 h-4" /> Limited Founding Offer · 20 Memberships
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold mt-6">Founding Platinum</h1>
          <p className="text-slate-300 mt-4 max-w-2xl mx-auto">Help launch Alcohol Delivered in Pine Bluff and receive permanent founding-member status plus service-related benefits.</p>
        </div>

        <div className="mt-10 grid md:grid-cols-[1.1fr_.9fr] gap-6">
          <section className="rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 backdrop-blur">
            <h2 className="text-2xl font-bold">Membership benefits</h2>
            <div className="mt-6 space-y-4">
              {[
                'Founding Platinum status for the life of the Alcohol Delivered membership program',
                '$2 off the Alcohol Delivered service fee on up to 12 completed orders per calendar year',
                'Priority customer support',
                'Early access when new service areas and app features open',
                'Founding Platinum badge on your account',
                'Access to member-only service promotions',
              ].map((benefit) => (
                <div key={benefit} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                  <span className="text-slate-200">{benefit}</span>
                </div>
              ))}
            </div>
            <div className="mt-7 rounded-2xl border border-blue-300/25 bg-blue-400/10 p-4 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-300 shrink-0" />
              <p className="text-sm text-blue-100/85"><strong>No alcohol is included or given away.</strong> Alcohol products, applicable taxes, tips, mileage charges, and retailer prices remain separate.</p>
            </div>
          </section>

          <section className="rounded-3xl bg-white text-slate-950 p-6 md:p-8 shadow-2xl">
            {membership ? (
              <div className="text-center py-8">
                <Crown className="w-14 h-14 text-amber-500 mx-auto" />
                <h2 className="text-2xl font-bold mt-4">You’re a Founding Platinum Member</h2>
                <p className="text-slate-600 mt-2">Purchased {membership.purchased_at ? new Date(membership.purchased_at).toLocaleDateString() : ''}</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">One-time purchase</p>
                <div className="flex items-end gap-2 mt-2">
                  <span className="text-5xl font-bold">$500</span>
                  <span className="text-slate-500 mb-2">USD</span>
                </div>
                <p className="text-sm text-slate-600 mt-4">This is a membership purchase—not an investment, donation, loan, ownership interest, or promise of financial return.</p>

                <label className="mt-6 flex items-start gap-3 rounded-xl border bg-slate-50 p-4 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-5 h-5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                  <span className="text-sm text-slate-700">I am at least 21 years old and agree to the Founding Platinum Membership Terms below.</span>
                </label>

                <Button onClick={purchase} disabled={!accepted || loading} className="w-full h-12 mt-5 text-base gap-2">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening secure checkout…</> : <>Purchase with Stripe <ArrowRight className="w-4 h-4" /></>}
                </Button>
                <p className="text-xs text-center text-slate-500 mt-3">Secure one-time checkout. Funds are paid to Alcohol Delivered, LLC under Stripe’s payout schedule.</p>
              </>
            )}
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-slate-300">
          <h2 className="font-semibold text-white text-lg">Founding Platinum Membership Terms</h2>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>Purchaser must be 21 or older. Membership is personal and nontransferable.</li>
            <li>Membership does not include alcohol and never makes an alcohol product free.</li>
            <li>Retailer product prices, alcohol taxes, tips, delivery mileage charges, and other third-party charges are not discounted unless expressly stated in a lawful separate promotion.</li>
            <li>The annual service-fee benefit is limited to $2 per eligible completed order and 12 uses per calendar year. Unused uses do not roll over or have cash value.</li>
            <li>“Lifetime” means while Alcohol Delivered, LLC continues operating the membership program; it is not the purchaser’s natural lifetime and does not guarantee uninterrupted service or availability in every location.</li>
            <li>This purchase provides no equity, ownership, voting rights, dividends, profit share, repayment, interest, or financial return.</li>
            <li>Founding memberships are limited to 20. Refund requests may be submitted within 7 days if no benefit has been used; processing fees may be nonrefundable where permitted by law.</li>
            <li>Alcohol Delivered may modify nonfinancial perks for safety, legal, operational, or regulatory reasons. The stated annual $2 service-fee benefit will not be reduced for active members except where required by law.</li>
          </ul>
          <p className="mt-4 text-xs text-slate-400">Terms version: {TERMS_VERSION}</p>
        </section>
      </div>
    </div>
  );
}