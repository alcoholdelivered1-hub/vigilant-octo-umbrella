import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Landmark, ShieldCheck, CheckCircle2, ExternalLink, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function PayoutSettings() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  // Handle return from Stripe Connect onboarding (?connected=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      // Mark as onboarded optimistically; the webhook will confirm
      base44.auth.updateMe({ stripe_connect_onboarded: true }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['me'] });
        toast.success("🎉 Stripe account connected! You're all set for payouts.");
      }).catch(() => {});
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleConnectStripe = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await base44.functions.invoke('stripeConnectOnboard', {
        return_url: `${origin}/driver/earnings?connected=1`,
        refresh_url: `${origin}/driver/earnings`,
      });
      const { url } = res.data;
      if (url) window.location.href = url;
      else toast.error('Failed to get onboarding link');
    } catch (err) {
      toast.error('Could not start Stripe onboarding: ' + err.message);
    }
    setLoading(false);
  };

  if (isLoading) return null;

  const isConnected = user?.stripe_connect_onboarded && user?.stripe_connect_account_id;
  const hasPendingAccount = user?.stripe_connect_account_id && !user?.stripe_connect_onboarded;

  return (
    <div className="bg-card rounded-2xl border">
      {/* Header */}
      <div className="flex items-center gap-3 p-5 border-b">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Payout Account</h2>
          <p className="text-xs text-muted-foreground">Powered by Stripe Connect — direct bank deposits every Monday</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {isConnected ? (
          /* Fully connected */
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Stripe account connected</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Payouts are automatically sent every Monday for the previous week's deliveries.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Account ID:</strong> {user.stripe_connect_account_id}</p>
              <p><strong>Payout schedule:</strong> Every Monday (weekly)</p>
              <p><strong>Earnings:</strong> $4.75 per delivery + 100% of tips</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl gap-2"
              onClick={handleConnectStripe}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Update bank account / re-verify
            </Button>
          </div>
        ) : hasPendingAccount ? (
          /* Account created but onboarding not completed */
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Onboarding incomplete</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Complete your Stripe setup to receive weekly payouts.
                </p>
              </div>
            </div>
            <Button onClick={handleConnectStripe} disabled={loading} className="w-full rounded-xl gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {loading ? 'Loading…' : 'Complete Stripe Setup'}
            </Button>
          </div>
        ) : (
          /* No account yet */
          <div className="space-y-3">
            <div className="bg-muted/50 border border-dashed rounded-xl p-5 text-center space-y-2">
              <Landmark className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">No payout account linked</p>
              <p className="text-xs text-muted-foreground">
                Connect your bank via Stripe to receive automatic weekly payouts every Monday.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-800">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Your bank info is handled securely by Stripe. We never store your account details.
            </div>

            <Button onClick={handleConnectStripe} disabled={loading} className="w-full rounded-xl gap-2 h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              {loading ? 'Loading…' : 'Connect Bank with Stripe'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Earnings: $4.75/delivery + 100% of tips · Paid every Monday
            </p>
          </div>
        )}
      </div>
    </div>
  );
}