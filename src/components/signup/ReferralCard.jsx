import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Copy, Check, Users, TrendingUp, Gift, QrCode, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import SocialShareButtons from '@/components/shared/SocialShareButtons';
import { cn } from '@/lib/utils';

const MILESTONES = [
  { count: 1, label: 'Skip the line', emoji: '⬆️', desc: 'Jump ahead of others' },
  { count: 3, label: '30 days free delivery', emoji: '🎁', desc: 'Save $90+' },
  { count: 5, label: 'VIP launch party', emoji: '🎉', desc: 'Exclusive invite' },
  { count: 10, label: 'Free membership', emoji: '👑', desc: '1 month on us' },
];

export default function ReferralCard({ referralCode, role, fullName }) {
  const [stats, setStats] = useState({ total_signups: 0, your_referral_count: 0, your_position: null });
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [loading, setLoading] = useState(true);

  const referralUrl = referralCode
    ? `${window.location.origin}/early-signup?ref=${referralCode}`
    : `${window.location.origin}/early-signup`;

  useEffect(() => {
    if (!referralCode) return;
    let cancelled = false;
    const fetchStats = () => {
      base44.functions.invoke('getSignupStats', { referral_code: referralCode })
        .then(res => {
          if (!cancelled && res.data) {
            setStats(res.data);
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [referralCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const nextMilestone = MILESTONES.find(m => m.count > stats.your_referral_count);
  const progressPct = nextMilestone
    ? Math.min(100, (stats.your_referral_count / nextMilestone.count) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Position + total social proof */}
      {!loading && stats.your_position && (
        <div className="flex items-center justify-between bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-4">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-primary tabular-nums">#{stats.your_position}</p>
            <p className="text-xs text-muted-foreground">Your spot in line</p>
          </div>
          <div className="w-px h-10 bg-border" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-secondary tabular-nums">{stats.total_signups.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total signups</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Referral link */}
      <div>
        <p className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-primary" /> Your referral link
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={referralUrl}
            onClick={(e) => e.target.select()}
            className="flex-1 text-xs border rounded-lg px-3 py-2.5 bg-muted/30 text-muted-foreground truncate"
          />
          <button
            onClick={handleCopy}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors',
              copied ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowQR(s => !s)}
            className={cn(
              'flex items-center justify-center rounded-lg px-3 py-2.5 text-xs font-semibold border transition-colors',
              showQR ? 'bg-muted border-primary' : 'hover:bg-muted'
            )}
            title="Show QR code"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
        {showQR && (
          <div className="mt-3 flex flex-col items-center gap-2 p-4 bg-white rounded-xl border">
            <QRCodeSVG value={referralUrl} size={160} includeMargin level="M" />
            <p className="text-xs text-muted-foreground">Scan to sign up</p>
          </div>
        )}
      </div>

      {/* Milestone progress */}
      {!loading && (
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Gift className="w-4 h-4 text-secondary" /> Unlock rewards
            </p>
            <p className="text-xs font-bold text-primary tabular-nums">{stats.your_referral_count} referred</p>
          </div>
          {nextMilestone && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Next: {nextMilestone.emoji} {nextMilestone.label}</span>
                <span className="font-semibold">{stats.your_referral_count}/{nextMilestone.count}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {MILESTONES.map(m => {
              const unlocked = stats.your_referral_count >= m.count;
              return (
                <div
                  key={m.count}
                  className={cn(
                    'flex items-center gap-2 rounded-lg p-2 text-xs transition-all',
                    unlocked ? 'bg-emerald-50 border border-emerald-200' : 'bg-background border border-border opacity-60'
                  )}
                >
                  <span className="text-base">{unlocked ? '✅' : m.emoji}</span>
                  <div>
                    <p className={cn('font-semibold leading-tight', unlocked && 'text-emerald-700')}>{m.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{m.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Share buttons */}
      <SocialShareButtons url={referralUrl} role={role} />

      {stats.your_referral_count > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-medium">
          <TrendingUp className="w-3.5 h-3.5" />
          You've referred {stats.your_referral_count} {stats.your_referral_count === 1 ? 'friend' : 'friends'} — keep it up!
        </div>
      )}
    </div>
  );
}