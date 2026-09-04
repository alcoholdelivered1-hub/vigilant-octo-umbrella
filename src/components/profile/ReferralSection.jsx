import React, { useState } from 'react';
import { Gift, Copy, Check, Users, DollarSign, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ReferralSection({ user }) {
  const [copied, setCopied] = useState(false);

  const referralCode = user?.referral_code || '—';
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;
  const referralCount = user?.referral_count || 0;
  const referralCredits = user?.referral_credits || 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopied(true);
    toast.success('Referral link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Join Alcohol Delivered',
        text: `Use my referral code ${referralCode} to get $3.00 off your first order on Alcohol Delivered!`,
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary/5 to-secondary/10 border border-primary/20 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gift className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Referral Program</h3>
          <p className="text-xs text-muted-foreground">Invite friends · Earn $5 per referral · They get $3 off</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/60 rounded-xl p-3 text-center border">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-primary">{referralCount}</p>
          <p className="text-xs text-muted-foreground">Friends Referred</p>
        </div>
        <div className="bg-white/60 rounded-xl p-3 text-center border">
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-4 h-4 text-secondary" />
          </div>
          <p className="text-2xl font-bold text-secondary">${(referralCredits / 100).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Credits Earned</p>
        </div>
      </div>

      {/* Referral Code */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Referral Code</p>
        <div className="flex items-center gap-2 bg-white rounded-xl border p-3">
          <code className="flex-1 text-lg font-bold tracking-widest text-primary text-center">{referralCode}</code>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white/50 rounded-xl p-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground text-sm">How it works:</p>
        <div className="flex items-start gap-2"><span className="font-bold text-primary">1.</span><span>Share your link with friends</span></div>
        <div className="flex items-start gap-2"><span className="font-bold text-primary">2.</span><span>They sign up and enter your code</span></div>
        <div className="flex items-start gap-2"><span className="font-bold text-primary">3.</span><span>They get <strong>$3.00 credit</strong> + 30 loyalty points</span></div>
        <div className="flex items-start gap-2"><span className="font-bold text-primary">4.</span><span>You earn <strong>$5.00 credit</strong> + 50 loyalty points</span></div>
      </div>

      <Button onClick={handleShare} className="w-full rounded-xl gap-2">
        <Share2 className="w-4 h-4" /> Share Your Referral Link
      </Button>

      {user?.referred_by_code && (
        <p className="text-center text-xs text-muted-foreground">
          ✅ You were referred by a friend — enjoy your welcome credit!
        </p>
      )}
    </div>
  );
}