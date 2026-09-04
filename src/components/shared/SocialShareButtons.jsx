import React, { useState } from 'react';
import { Share2, Copy, Check, Facebook, MessageCircle, Mail, Send, QrCode, Link2 } from 'lucide-react';
import { toast } from 'sonner';

const SHARE_TEXTS = {
  customer: "🍷 Just claimed early access to Alcohol Delivered — launching in Pine Bluff, AR! Free first delivery + priority access for early signups. 21+ only. Get in line:",
  driver: "🚗 I'm driving for Alcohol Delivered when it launches in Pine Bluff! Earn $4.75/delivery + tips + launch-week bonuses. 21+ only. Sign up:",
  default: "🍷 Alcohol Delivered is launching in Pine Bluff, AR! Get early access — 21+ only. Free first delivery for early signups:",
};

export default function SocialShareButtons({ url, role, title }) {
  const shareUrl = url || (typeof window !== 'undefined' ? `${window.location.origin}/early-signup` : '');
  const shareText = SHARE_TEXTS[role] || SHARE_TEXTS.default;
  const fullText = `${shareText} ${shareUrl}`;
  const [copied, setCopied] = useState(false);

  const platforms = [
    {
      name: 'Facebook',
      icon: <Facebook className="w-4 h-4" />,
      bg: 'bg-[#1877F2] hover:bg-[#166FE5]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'X',
      icon: <span className="text-sm font-bold">𝕏</span>,
      bg: 'bg-black hover:bg-neutral-800',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`,
    },
    {
      name: 'WhatsApp',
      icon: <MessageCircle className="w-4 h-4" />,
      bg: 'bg-[#25D366] hover:bg-[#20BD5A]',
      href: `https://wa.me/?text=${encodeURIComponent(fullText)}`,
    },
    {
      name: 'Telegram',
      icon: <Send className="w-4 h-4" />,
      bg: 'bg-[#0088CC] hover:bg-[#0077B5]',
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Reddit',
      icon: <span className="text-sm font-bold">r/</span>,
      bg: 'bg-[#FF4500] hover:bg-[#E03D00]',
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'SMS',
      icon: <MessageCircle className="w-4 h-4" />,
      bg: 'bg-emerald-600 hover:bg-emerald-700',
      href: `sms:?&body=${encodeURIComponent(fullText)}`,
    },
    {
      name: 'Email',
      icon: <Mail className="w-4 h-4" />,
      bg: 'bg-slate-600 hover:bg-slate-700',
      href: `mailto:?subject=${encodeURIComponent('🍷 Early Access — Alcohol Delivered (21+)')}&body=${encodeURIComponent(fullText)}`,
    },
    {
      name: 'LinkedIn',
      icon: <span className="text-sm font-bold">in</span>,
      bg: 'bg-[#0A66C2] hover:bg-[#0958A8]',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'IG Caption',
      icon: <span className="text-xs font-bold">IG</span>,
      bg: 'bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#FCB045] hover:opacity-90',
      copyText: fullText,
    },
  ];

  const handlePlatformClick = (p) => {
    if (p.copyText) {
      navigator.clipboard.writeText(p.copyText).then(() => {
        toast.success('Caption copied! Paste it in your Instagram story.', { duration: 4000 });
      }).catch(() => toast.error('Could not copy'));
      return false; // prevent default
    }
    return true;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || 'Alcohol Delivered — Early Access', text: shareText, url: shareUrl });
      } catch {}
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2">
        <Share2 className="w-4 h-4 text-primary" /> Share everywhere (21+ only)
      </p>
      <div className="grid grid-cols-3 gap-2">
        {platforms.map(p => (
          <a
            key={p.name}
            href={p.href}
            target={p.copyText ? undefined : '_blank'}
            rel="noopener noreferrer"
            onClick={(e) => { if (!handlePlatformClick(p)) e.preventDefault(); }}
            className={`flex items-center justify-center gap-1.5 ${p.bg} text-white text-xs font-semibold py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95`}
          >
            {p.icon}
            {p.name}
          </a>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 border rounded-xl py-2.5 text-xs font-semibold hover:bg-muted transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        {typeof navigator !== 'undefined' && navigator.share && (
          <button
            onClick={handleNativeShare}
            className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-xl py-2.5 text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Share2 className="w-4 h-4" /> More…
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">Must be 21+ to sign up. Please share responsibly. 🍷</p>
    </div>
  );
}