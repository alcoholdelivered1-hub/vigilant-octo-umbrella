import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Download, Copy, Check, Wine, Send, Users, MapPin, DollarSign,
  Facebook, Instagram, Music2, Twitter, Search, Mail, MessageSquare,
  Megaphone, Loader2, Target, TrendingUp
} from 'lucide-react';

const AD_IMAGES = {
  flat_lay: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/cd279c28b_generated_image.png',
  party: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/78b6004fb_generated_image.png',
  phone: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/8fcc96262_generated_image.png',
  customer_product: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/0fc687275_generated_image.png',
  customer_social: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/3f88b2a6a_generated_image.png',
  customer_app: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/22fac06bb_generated_image.png',
};

const SIGNUP_URL = 'https://alcohol-delivered.biz/early-signup';

// ── Facebook Feed Ads ──────────────────────────────────────
const FACEBOOK_ADS = [
  {
    id: 'fb_1',
    image: AD_IMAGES.flat_lay,
    format: 'Feed Post (4:5 or 1:1)',
    headline: 'Beer, Wine & Spirits — Delivered in 45 Min',
    primary_text: `Craving a cold one but don't want to drive? 🍺 Alcohol Delivered brings your favorite drinks right to your door in under 45 minutes.

Fully licensed, ID-verified, and locally owned in Pine Bluff, AR.

🎁 Early signup perks:
✅ FREE first delivery
✅ 30-day free trial
✅ Just $4.75 delivery fee — no surge pricing

Sign up now and be first when we launch → ${SIGNUP_URL}`,
    cta: 'Sign Up',
  },
  {
    id: 'fb_2',
    image: AD_IMAGES.party,
    format: 'Feed Post (4:5 or 1:1)',
    headline: 'Party? We Deliver. 🎉',
    primary_text: `Hosting friends? Ran out of drinks? Don't leave the party — we'll bring the store to you. 🍻

Beer, wine, and spirits delivered fast across Central Arkansas. Real-time GPS tracking, licensed retailers, ID-verified delivery.

First delivery is on us when you sign up early. No credit card needed.
👉 Claim your free delivery → ${SIGNUP_URL}`,
    cta: 'Learn More',
  },
  {
    id: 'fb_3',
    image: AD_IMAGES.customer_app,
    format: 'Feed Post (4:5 or 1:1)',
    headline: 'Tap. Order. Delivered. 📱',
    primary_text: `Order alcohol from your phone in seconds. Real-time GPS tracking, licensed retailers, ID-verified delivery.

Serving Pine Bluff and Central Arkansas. Start your free 30-day trial today — just $10/month after. No commitment, cancel anytime.

First delivery is FREE for early signups!
👉 ${SIGNUP_URL}`,
    cta: 'Download',
  },
];

// ── Instagram Ads ──────────────────────────────────────────
const INSTAGRAM_ADS = [
  {
    id: 'ig_feed_1',
    image: AD_IMAGES.flat_lay,
    format: 'Feed Post (1:1 or 4:5)',
    headline: 'Drinks Delivered. 🍻',
    primary_text: `Your favorite beer, wine, and spirits — delivered to your door in under 45 minutes. Free first delivery for early signups. 21+ only.\n\nTap to claim → ${SIGNUP_URL}`,
    cta: 'Sign Up',
  },
  {
    id: 'ig_story_1',
    image: AD_IMAGES.party,
    format: 'Story (9:16)',
    headline: 'FREE First Delivery 🎁',
    primary_text: `Swipe up to claim your free first delivery from Alcohol Delivered.\n\n30-day free trial · $4.75 delivery fee · No surge pricing\n21+ only\n\n${SIGNUP_URL}`,
    cta: 'Swipe Up',
  },
  {
    id: 'ig_story_2',
    image: AD_IMAGES.phone,
    format: 'Story (9:16)',
    headline: 'Party? We Deliver. 🎉',
    primary_text: `Drinks running low? We'll bring the store to you in under 45 min.\n\nFree first delivery for early signups 🍺\n21+ only\n\n${SIGNUP_URL}`,
    cta: 'Sign Up',
  },
];

// ── TikTok Ads ─────────────────────────────────────────────
const TIKTOK_ADS = [
  {
    id: 'tt_1',
    image: AD_IMAGES.phone,
    format: 'In-Feed Video (9:16)',
    headline: 'Alcohol Delivered to Your Door 🍺',
    primary_text: `POV: You're craving a drink but don't want to leave the house 😅 Alcohol Delivered brings beer, wine, and spirits right to your door in under 45 min. Free first delivery for early signups! 21+\n\nLink in bio 📲 ${SIGNUP_URL}`,
    cta: 'Sign Up Now',
  },
  {
    id: 'tt_2',
    image: AD_IMAGES.party,
    format: 'In-Feed Video (9:16)',
    headline: 'We Deliver the Party 🎉',
    primary_text: `When the drinks run out at your party but the night's still young 🍻 Don't leave — we'll bring the store to you.\n\nAlcohol Delivered: under 45 min, $4.75 delivery fee, free first delivery. Sign up early! 21+\n\n${SIGNUP_URL}`,
    cta: 'Learn More',
  },
];

// ── Twitter/X Ads ──────────────────────────────────────────
const TWITTER_ADS = [
  {
    id: 'tw_1',
    format: 'Promoted Post',
    headline: 'Beer, wine & spirits delivered in 45 min',
    primary_text: `Craving a drink? 🍺 Alcohol Delivered brings your favorites right to your door in under 45 minutes. Free first delivery for early signups + 30-day free trial.\n\nPine Bluff & Central AR. 21+ only.\n\nSign up → ${SIGNUP_URL}`,
    cta: 'Visit Site',
  },
  {
    id: 'tw_2',
    format: 'Promoted Post',
    headline: 'Free first delivery 🎁',
    primary_text: `Don't drive to the store — we'll bring it to you. 🚗💨 Beer, wine, spirits delivered in under 45 min. $4.75 delivery fee, no surge pricing. Free first delivery when you sign up early.\n\n21+ → ${SIGNUP_URL}`,
    cta: 'Sign Up',
  },
];

// ── Google Search Ads ──────────────────────────────────────
const GOOGLE_SEARCH_ADS = [
  {
    id: 'gs_1',
    ad_group: 'Alcohol Delivery',
    keywords: 'alcohol delivery, alcohol delivery pine bluff, beer delivery, wine delivery, liquor delivery arkansas',
    headlines: [
      'Alcohol Delivered in 45 Min',
      'Beer, Wine & Spirits to Your Door',
      'Free First Delivery - Sign Up',
    ],
    descriptions: [
      'Order beer, wine, and spirits from local retailers. Delivered in under 45 minutes. Fully licensed & ID-verified. $4.75 delivery fee.',
      'Early signup perks: Free first delivery + 30-day free trial. Locally owned in Pine Bluff, AR. 21+ only. Sign up today!',
    ],
  },
  {
    id: 'gs_2',
    ad_group: 'Liquor Store Delivery',
    keywords: 'liquor store delivery, liquor delivery near me, spirits delivered, alcohol delivered to door',
    headlines: [
      'Liquor Store Delivery',
      'Spirits Delivered to Your Door',
      'Order Online - 45 Min Delivery',
    ],
    descriptions: [
      'Skip the trip to the liquor store. Order online and get spirits, wine, and beer delivered in under 45 minutes. $4.75 delivery fee.',
      "Arkansas's first licensed alcohol delivery platform. Free first delivery for early signups. 21+ only.",
    ],
  },
  {
    id: 'gs_3',
    ad_group: 'Party & Event Drinks',
    keywords: 'party drinks delivery, event alcohol delivery, tailgate delivery, alcohol delivery for party',
    headlines: [
      'Party Drinks? We Deliver',
      "Don't Leave the Party - We Deliver",
      'Beer & Wine Delivered Fast',
    ],
    descriptions: [
      'Hosting a party? Get beer, wine, and spirits delivered in under 45 minutes. Free first delivery for early signups.',
      'Real-time GPS tracking, licensed retailers, ID-verified delivery. Serving Pine Bluff & Central Arkansas. 21+ only.',
    ],
  },
];

// ── Google Display Ads ─────────────────────────────────────
const GOOGLE_DISPLAY_ADS = [
  {
    id: 'gd_1',
    image: AD_IMAGES.flat_lay,
    format: 'Responsive Display (1200x628)',
    headline: 'Drinks Delivered Fast 🍺',
    primary_text: 'Beer, wine & spirits to your door in 45 min. Free first delivery for early signups. 21+',
    cta: 'Sign Up',
  },
  {
    id: 'gd_2',
    image: AD_IMAGES.party,
    format: 'Responsive Display (1200x628)',
    headline: 'Party? We Deliver. 🎉',
    primary_text: "Don't leave the party — we'll bring the drinks. Free first delivery for early signups. 21+",
    cta: 'Learn More',
  },
];

// ── Email Campaign ─────────────────────────────────────────
const EMAIL_SUBJECTS = [
  '🎉 We\'re Launching Soon — Claim Your FREE First Delivery!',
  'Your drinks are calling 🍺 Free first delivery inside',
  'Don\'t drive to the store — we\'ll bring it to you 🚗',
  'Early access: Free 30-day trial + first delivery on us 🎁',
  '🍺 Beer, wine & spirits delivered in 45 min — sign up early!',
];

// ── SMS Messages (160 char limit) ──────────────────────────
const SMS_MESSAGES = [
  'Alcohol Delivered is launching in Pine Bluff! Get FREE first delivery + 30-day free trial. Sign up: alcohol-delivered.biz/early-signup (21+)',
  'Craving a drink? Get beer, wine & spirits delivered to your door in 45 min. FREE first delivery for early signups: alcohol-delivered.biz/early-signup (21+)',
  'Party running low? We deliver beer, wine & spirits in under 45 min. $4.75 delivery fee, no surge pricing. Free first delivery: alcohol-delivered.biz/early-signup',
];

// ── Targeting Guide ────────────────────────────────────────
const TARGETING = [
  {
    platform: 'Facebook & Instagram',
    icon: Facebook,
    location: '15-25 mile radius around Pine Bluff (71601, 71603, 71611), Little Rock, Sherwood, Cabot, Maumelle',
    demographics: 'Age 21-55, all genders',
    interests: 'Beer, wine, spirits, nightlife, tailgating, party planning, convenience, food delivery, DoorDash, Uber Eats',
    budget: '$10-15/day per ad set, 5-7 day test',
  },
  {
    platform: 'TikTok',
    icon: Music2,
    location: '20 mile radius around Pine Bluff & Little Rock',
    demographics: 'Age 21-35, all genders',
    interests: 'Food & beverage, entertainment, nightlife, party, lifestyle',
    budget: '$10-20/day per ad group, 5-7 day test',
  },
  {
    platform: 'Twitter/X',
    icon: Twitter,
    location: 'Arkansas (state-level), Pine Bluff + Little Rock metro',
    demographics: 'Age 21-45, all genders',
    interests: 'Food & drink, nightlife, local news, convenience services',
    budget: '$5-10/day per campaign, 5-7 day test',
  },
  {
    platform: 'Google Search',
    icon: Search,
    location: 'Pine Bluff, Little Rock, Sherwood, Cabot, Maumelle + 20 mile radius',
    demographics: 'Age 21+ (Google will auto-restrict under 21)',
    keywords: 'alcohol delivery, liquor delivery, beer delivery, wine delivery, spirits delivery',
    budget: '$15-25/day, bid strategy: maximize clicks',
  },
  {
    platform: 'Google Display',
    icon: Search,
    location: '15-25 mile radius around Pine Bluff & Little Rock',
    demographics: 'Age 21+',
    placements: 'Auto: food & drink, entertainment, lifestyle sites + apps',
    budget: '$5-10/day, bid strategy: maximize conversions',
  },
  {
    platform: 'SMS / Email',
    icon: MessageSquare,
    location: 'All existing contacts',
    demographics: 'All registered users + early signups',
    interests: 'N/A — warm audience already opted in',
    budget: 'Free (built-in tools)',
  },
];

export default function CustomerAdCampaign() {
  const [copiedId, setCopiedId] = useState(null);
  const [sendingBlast, setSendingBlast] = useState(false);

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadImage = async (url, filename) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Download failed — try right-clicking the image instead.');
    }
  };

  const sendEmailBlast = async () => {
    setSendingBlast(true);
    try {
      const res = await base44.functions.invoke('sendCustomerSignupBlast', {});
      if (res?.success) {
        const skippedCount = res.skipped?.length || 0;
        if (skippedCount > 0) {
          toast.success(`Blast sent: ${res.sent} delivered, ${res.failed} failed, ${skippedCount} skipped (invalid emails).`);
          console.log('Skipped invalid emails:', res.skipped);
        } else {
          toast.success(`Email blast sent! ${res.sent} delivered, ${res.failed} failed.`);
        }
      } else {
        toast.error(res?.error || 'Failed to send blast.');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send blast.');
    }
    setSendingBlast(false);
  };

  const renderImageAd = (ad, platform) => {
    return (
      <Card key={ad.id} className="overflow-hidden">
        {ad.image && (
          <div className="relative">
            <img src={ad.image} alt={ad.headline} className="w-full h-56 object-cover" />
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-medium">
              {ad.format}
            </div>
          </div>
        )}
        <div className="p-4 space-y-3">
          {!ad.image && (
            <div className="bg-muted/50 text-xs px-2 py-1 rounded-full inline-block font-medium text-muted-foreground">
              {ad.format}
            </div>
          )}
          <CopyField label="Headline" text={ad.headline} id={ad.id + '_headline'} copiedId={copiedId} onCopy={copyText} />
          <CopyField label="Primary Text" text={ad.primary_text} id={ad.id + '_text'} copiedId={copiedId} onCopy={copyText} multiline />
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs bg-secondary/10 text-secondary font-medium px-2.5 py-1 rounded-full">CTA: {ad.cta}</span>
            {ad.image && (
              <Button size="sm" variant="outline" onClick={() => downloadImage(ad.image, `ad-${platform}-${ad.id}.png`)}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderGoogleSearchAd = (ad) => (
    <Card key={ad.id} className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">{ad.ad_group}</span>
      </div>
      <CopyField label="Target Keywords" text={ad.keywords} id={ad.id + '_kw'} copiedId={copiedId} onCopy={copyText} multiline />
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Headlines (3 × 30 char max)</p>
        {ad.headlines.map((h, i) => (
          <CopyField key={i} label={`H${i + 1}`} text={h} id={`${ad.id}_h${i}`} copiedId={copiedId} onCopy={copyText} compact />
        ))}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Descriptions (2 × 90 char max)</p>
        {ad.descriptions.map((d, i) => (
          <CopyField key={i} label={`D${i + 1}`} text={d} id={`${ad.id}_d${i}`} copiedId={copiedId} onCopy={copyText} multiline />
        ))}
      </div>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Megaphone className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-bold">Customer Signup Campaign</h1>
          </div>
          <p className="text-sm text-muted-foreground">Ready-to-use ad copy & creatives for every platform. Copy text, download images, launch campaigns.</p>
        </div>
        <Button onClick={sendEmailBlast} disabled={sendingBlast} size="lg" className="rounded-xl h-12 px-6">
          {sendingBlast ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {sendingBlast ? 'Sending...' : 'Send Email Blast'}
        </Button>
      </div>

      {/* Campaign Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wine} label="Platforms" value="7" color="text-primary" />
        <StatCard icon={Users} label="Target Audience" value="21+ AR" color="text-secondary" />
        <StatCard icon={DollarSign} label="Delivery Fee" value="$4.75" color="text-emerald-600" />
        <StatCard icon={MapPin} label="Service Area" value="Central AR" color="text-primary" />
      </div>

      {/* Facebook & Instagram */}
      <PlatformSection icon={Facebook} title="Facebook Feed Ads" subtitle="Best for broad reach & retargeting" ads={FACEBOOK_ADS} platform="facebook" renderAd={renderImageAd} />

      {/* Instagram */}
      <PlatformSection icon={Instagram} title="Instagram Ads" subtitle="Feed posts + Story ads (9:16)" ads={INSTAGRAM_ADS} platform="instagram" renderAd={renderImageAd} />

      {/* TikTok */}
      <PlatformSection icon={Music2} title="TikTok Ads" subtitle="Short-form video, 9:16 vertical" ads={TIKTOK_ADS} platform="tiktok" renderAd={renderImageAd} />

      {/* Twitter/X */}
      <PlatformSection icon={Twitter} title="Twitter / X Ads" subtitle="Promoted posts, 280 char limit" ads={TWITTER_ADS} platform="twitter" renderAd={renderImageAd} />

      {/* Google Search */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Google Search Ads</h2>
          <span className="text-xs text-muted-foreground">({GOOGLE_SEARCH_ADS.length} ad groups)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GOOGLE_SEARCH_ADS.map(renderGoogleSearchAd)}
        </div>
      </div>

      {/* Google Display */}
      <PlatformSection icon={Search} title="Google Display Ads" subtitle="Visual banners on websites & apps" ads={GOOGLE_DISPLAY_ADS} platform="google-display" renderAd={renderImageAd} />

      {/* Email Campaign */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Email Campaign</h2>
          <span className="text-xs text-muted-foreground">(A/B test subject lines)</span>
        </div>
        <Card className="p-4 space-y-3">
          <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 flex items-start gap-3">
            <Send className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">One-Click Email Blast</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sends to all registered users & early signups. Uses the subject line below — A/B test by sending multiple blasts with different subjects.</p>
              <p className="text-xs text-muted-foreground mt-1"><strong>Current subject:</strong> {EMAIL_SUBJECTS[0]}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">A/B Test Subject Lines</p>
            {EMAIL_SUBJECTS.map((subject, i) => (
              <CopyField key={i} label={`Option ${i + 1}`} text={subject} id={`email_sub_${i}`} copiedId={copiedId} onCopy={copyText} />
            ))}
          </div>
        </Card>
      </div>

      {/* SMS Campaign */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">SMS Messages</h2>
          <span className="text-xs text-muted-foreground">(160 char max)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SMS_MESSAGES.map((msg, i) => (
            <Card key={i} className="p-4 space-y-2">
              <CopyField label={`Message ${i + 1} (${msg.length} chars)`} text={msg} id={`sms_${i}`} copiedId={copiedId} onCopy={copyText} multiline />
            </Card>
          ))}
        </div>
      </div>

      {/* Targeting Guide */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Targeting & Budget Guide</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-semibold">Platform</th>
                <th className="text-left p-3 font-semibold">Location</th>
                <th className="text-left p-3 font-semibold">Demographics</th>
                <th className="text-left p-3 font-semibold">Interests / Keywords</th>
                <th className="text-left p-3 font-semibold">Budget</th>
              </tr>
            </thead>
            <tbody>
              {TARGETING.map((t, i) => {
                const Icon = t.icon;
                return (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Icon className="w-3.5 h-3.5 text-primary" /> {t.platform}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{t.location}</td>
                    <td className="p-3 text-muted-foreground">{t.demographics}</td>
                    <td className="p-3 text-muted-foreground">{t.interests || t.keywords || t.placements}</td>
                    <td className="p-3 text-muted-foreground font-medium">{t.budget}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Launch Checklist */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-display font-bold">Campaign Launch Checklist</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {[
            'Download all ad images from each section',
            'Set up Facebook Ads Manager campaign (Conversions objective)',
            'Create Instagram ad set using same images + Story format',
            'Set up TikTok Ads Manager — upload 9:16 videos/images',
            'Create Twitter/X promoted posts with copy',
            'Build Google Search ad groups with keywords above',
            'Set up Google Display responsive ads with images',
            'Send email blast to existing contacts',
            'Schedule SMS campaign (if using SMS provider)',
            'Set daily budgets: $10-15/day per platform to start',
            'Monitor for 3-5 days, pause underperformers, scale winners',
            'Use UTM links to track signups per platform',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Reusable Components ────────────────────────────────────

function CopyField({ label, text, id, copiedId, onCopy, multiline, compact }) {
  return (
    <div>
      <p className={`text-xs font-medium text-muted-foreground ${compact ? 'mb-0.5' : 'mb-1'}`}>{label}</p>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm ${multiline ? 'text-muted-foreground leading-relaxed whitespace-pre-line' : 'font-medium'} ${compact ? 'text-xs' : ''}`}>
          {text}
        </p>
        <button onClick={() => onCopy(text, id)} className="flex-shrink-0 text-muted-foreground hover:text-primary mt-0.5">
          {copiedId === id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-bold text-lg">{value}</p>
      </div>
    </Card>
  );
}

function PlatformSection({ icon: Icon, title, subtitle, ads, platform, renderAd }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-display font-bold">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle} · ({ads.length} ads)</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map(ad => renderAd(ad, platform))}
      </div>
    </div>
  );
}