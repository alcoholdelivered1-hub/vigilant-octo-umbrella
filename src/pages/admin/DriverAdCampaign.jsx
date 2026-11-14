import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Download, Copy, Check, Car, Send, Users, MapPin, DollarSign,
  Facebook, Instagram, Music2, Twitter, Search, Mail, MessageSquare,
  Megaphone, Loader2, Target, TrendingUp, Zap
} from 'lucide-react';

const DRIVER_IMAGE = 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/1df2ab70b_generated_image.png';
const SIGNUP_URL = 'https://alcohol-delivered.biz/driver/signup';

// ── Live towns where liquor stores are operating ──────────
const LIVE_TOWNS = [
  { city: 'Pine Bluff', county: 'Jefferson', stores: 2, zip: '71601' },
  { city: 'Little Rock', county: 'Pulaski', stores: 6, zip: '72201' },
  { city: 'North Little Rock', county: 'Pulaski', stores: 6, zip: '72114' },
  { city: 'Sherwood', county: 'Pulaski', stores: 3, zip: '72120' },
  { city: 'Cabot', county: 'Lonoke', stores: 4, zip: '72023' },
  { city: 'Maumelle', county: 'Pulaski', stores: 3, zip: '72113' },
  { city: 'England', county: 'Lonoke', stores: 1, zip: '72046' },
];

// ── Facebook Feed Ads — one per live town ──────────────────
const FACEBOOK_ADS = LIVE_TOWNS.map((town, i) => ({
  id: `fb_${i}`,
  image: DRIVER_IMAGE,
  format: 'Feed Post (4:5 or 1:1)',
  headline: `Drive & Earn in ${town.city} — $4.75/Delivery`,
  primary_text: `🚗 We're hiring delivery drivers in ${town.city}, ${town.county} County! 

${town.stores} liquor store${town.stores > 1 ? 's are' : ' is'} LIVE and orders are rolling in. We need drivers 21+ to keep up.

✅ $4.75 per delivery (just increased!)
✅ Keep 100% of your tips
✅ $1/mile bonus on deliveries over 7 miles
✅ Free ABC alcohol safety certification
✅ Set your own hours — drive when you want
✅ Weekly Stripe payouts every Monday

No startup fees. No schedules. No bosses. Just download the app, get certified, and start earning.

👉 Apply now (takes ~10 min) → ${SIGNUP_URL}

21+ only · Arkansas ACT 157 compliant · Clean background required`,
  cta: 'Apply Now',
}));

// ── Instagram Ads ──────────────────────────────────────────
const INSTAGRAM_ADS = [
  {
    id: 'ig_feed_1',
    image: DRIVER_IMAGE,
    format: 'Feed Post (1:1 or 4:5)',
    headline: 'Earn $4.75/Delivery 🚗',
    primary_text: `Become an Alcohol Delivered driver in Central Arkansas. $4.75/delivery + 100% tips + $1/mile bonus. Free ABC certification. Drive when you want.\n\n21+ only · Apply → ${SIGNUP_URL}`,
    cta: 'Sign Up',
  },
  {
    id: 'ig_story_1',
    image: DRIVER_IMAGE,
    format: 'Story (9:16)',
    headline: 'Now Hiring — $4.75/Delivery 🚨',
    primary_text: `We need drivers 21+ across Central Arkansas!\n\n✅ $4.75 per delivery\n✅ 100% of tips\n✅ Free ABC certification\n✅ Weekly payouts\n\nSwipe up to apply → ${SIGNUP_URL}`,
    cta: 'Swipe Up',
  },
  {
    id: 'ig_story_2',
    image: DRIVER_IMAGE,
    format: 'Story (9:16)',
    headline: 'Drive When You Want ⏰',
    primary_text: `No schedules. No bosses. Just you, your car, and extra cash.\n\n$4.75/delivery + tips + mileage bonuses. Free training. Activated in 1–2 days.\n\n21+ → ${SIGNUP_URL}`,
    cta: 'Apply Now',
  },
];

// ── TikTok Ads ─────────────────────────────────────────────
const TIKTOK_ADS = [
  {
    id: 'tt_1',
    image: DRIVER_IMAGE,
    format: 'In-Feed Video (9:16)',
    headline: 'Get Paid to Deliver Alcohol 🍺💸',
    primary_text: `POV: You're 21+, have a car, and want extra cash 😎 Deliver alcohol for Alcohol Delivered — $4.75 per delivery, keep ALL your tips, plus $1/mile bonuses on long runs. Free ABC certification. Drive whenever you want.\n\nBeverage King just went LIVE and orders are surging 🚀\n\nLink in bio 📲 ${SIGNUP_URL}`,
    cta: 'Apply Now',
  },
  {
    id: 'tt_2',
    image: DRIVER_IMAGE,
    format: 'In-Feed Video (9:16)',
    headline: 'Side Hustle That Actually Pays 🚗',
    primary_text: `Need a side hustle? Deliver alcohol on your schedule.\n\n$4.75/delivery + 100% tips + $1/mile bonus over 7 mi. Free training. Weekly payouts. No startup fees.\n\n21+ only. Apply in 10 min → ${SIGNUP_URL}`,
    cta: 'Learn More',
  },
];

// ── Twitter/X Ads ──────────────────────────────────────────
const TWITTER_ADS = [
  {
    id: 'tw_1',
    format: 'Promoted Post',
    headline: 'Hiring drivers 21+ — $4.75/delivery',
    primary_text: `🚗 We're hiring alcohol delivery drivers across Central Arkansas! $4.75/delivery + 100% tips + $1/mile bonus. Free ABC certification. Set your own hours. Weekly Stripe payouts.\n\n21+ · Clean background required\n\nApply → ${SIGNUP_URL}`,
    cta: 'Apply Now',
  },
  {
    id: 'tw_2',
    format: 'Promoted Post',
    headline: 'Beverage King is LIVE — drivers needed',
    primary_text: `🍺 Beverage King just went live and orders are surging. We need drivers 21+ in Pine Bluff, Little Rock, Sherwood, Cabot, Maumelle & NLR.\n\n$4.75/delivery + tips + mileage bonuses. Free training. No startup fees.\n\n→ ${SIGNUP_URL}`,
    cta: 'Apply Now',
  },
];

// ── Google Search Ads ──────────────────────────────────────
const GOOGLE_SEARCH_ADS = [
  {
    id: 'gs_1',
    ad_group: 'Delivery Driver Jobs',
    keywords: 'delivery driver jobs, alcohol delivery driver, delivery jobs arkansas, part time delivery, gig jobs near me, driver hiring 21+',
    headlines: [
      'Hiring Drivers 21+ — $4.75/Delivery',
      'Deliver Alcohol — Set Your Hours',
      'Free ABC Certification — Apply Now',
    ],
    descriptions: [
      'Become a licensed alcohol delivery driver. $4.75/delivery + 100% tips + $1/mile bonus. Free training, weekly payouts. No startup fees. 21+ only.',
      'Now hiring across Central Arkansas. Drive when you want, earn on your schedule. Beverage King is live and orders are surging. Apply in 10 min!',
    ],
  },
  {
    id: 'gs_2',
    ad_group: 'Pine Bluff Driver Jobs',
    keywords: 'delivery jobs pine bluff, driver jobs pine bluff ar, part time jobs pine bluff, gig work pine bluff',
    headlines: [
      'Drive in Pine Bluff — $4.75/Delivery',
      'Hiring Pine Bluff Drivers 21+',
      'Earn Cash Delivering Alcohol',
    ],
    descriptions: [
      'Pine Bluff drivers needed! $4.75/delivery + 100% tips + $1/mile bonus. Free ABC cert, weekly payouts. Beverage King is live. Apply today!',
      'Local delivery gig in Pine Bluff & Jefferson County. Set your own hours, get paid weekly. 21+ only, clean background required.',
    ],
  },
  {
    id: 'gs_3',
    ad_group: 'Little Rock Driver Jobs',
    keywords: 'delivery jobs little rock, driver jobs little rock ar, part time jobs little rock, gig work little rock, uber driver little rock',
    headlines: [
      'Drive in Little Rock — $4.75/Delivery',
      'Hiring Little Rock Drivers 21+',
      'Better Than Rideshare — Keep Your Tips',
    ],
    descriptions: [
      'Little Rock & NLR drivers wanted! $4.75/delivery + 100% tips + $1/mile bonus. Free ABC certification. Drive when you want. Apply in 10 min.',
      '6 liquor stores live in Little Rock — orders are surging. Get activated in 1–2 days and start earning this week. 21+ only.',
    ],
  },
  {
    id: 'gs_4',
    ad_group: 'Sherwood / Cabot / Maumelle Driver Jobs',
    keywords: 'delivery jobs sherwood ar, driver jobs cabot, part time jobs maumelle, gig work sherwood, delivery driver cabot ar',
    headlines: [
      'Drive in Sherwood, Cabot & Maumelle',
      'Hiring Drivers 21+ — $4.75/Delivery',
      'Local Delivery Gig — Apply Today',
    ],
    descriptions: [
      'Drivers needed across Sherwood, Cabot & Maumelle! $4.75/delivery + 100% tips + mileage bonuses. Free training, weekly payouts. 21+ only.',
      'Multiple stores live in your area. Set your own hours, get paid every Monday. No startup fees. Apply in 10 minutes!',
    ],
  },
];

// ── Google Display Ads ─────────────────────────────────────
const GOOGLE_DISPLAY_ADS = [
  {
    id: 'gd_1',
    image: DRIVER_IMAGE,
    format: 'Responsive Display (1200x628)',
    headline: 'Earn $4.75/Delivery 🚗',
    primary_text: 'Become an alcohol delivery driver. 100% tips + $1/mile bonus. Free ABC certification. Drive when you want. 21+ only.',
    cta: 'Apply Now',
  },
  {
    id: 'gd_2',
    image: DRIVER_IMAGE,
    format: 'Responsive Display (1200x628)',
    headline: 'Now Hiring — No Cap on Drivers 🚨',
    primary_text: "Beverage King is LIVE. Orders are surging. We need drivers 21+ across Central Arkansas. Free training, weekly payouts.",
    cta: 'Apply Now',
  },
];

// ── SMS Messages (160 char limit) ──────────────────────────
const SMS_MESSAGES = [
  `Alcohol Delivered is hiring drivers 21+! $4.75/delivery + 100% tips + $1/mi bonus. Free ABC cert. Apply: ${SIGNUP_URL}`,
  `Beverage King is LIVE & we need drivers! $4.75/delivery + tips. Set your own hours. Apply in 10 min: ${SIGNUP_URL}`,
  `Drive & earn in Central Arkansas! $4.75/delivery + 100% tips + mileage bonus. Free training, weekly pay. 21+ → ${SIGNUP_URL}`,
];

// ── Email Subject Lines ────────────────────────────────────
const EMAIL_SUBJECTS = [
  '🚨 We\'re Hiring Drivers — $4.75/Delivery + Beverage King Just Went Live!',
  'Earn $4.75 per delivery 🚗 — Drivers needed in your area',
  'Side hustle that actually pays 💸 Keep 100% of your tips',
  'Drive when you want — get paid every Monday 📅',
  'Free ABC certification + $4.75/delivery — Apply in 10 min ⚡',
];

// ── Targeting & Budget Guide per live town ─────────────────
const TARGETING = LIVE_TOWNS.map(town => ({
  platform: 'Facebook & Instagram',
  icon: Facebook,
  location: `${town.city} (${town.zip}) + 15-mile radius`,
  demographics: 'Age 21–55, all genders',
  interests: 'Gig economy, DoorDash, Uber, Lyft, delivery driver, part-time jobs, side hustle, flexible work',
  budget: '$15–25/day per ad set, 7-day test',
  town: town.city,
}));

const TIKTOK_TARGETING = {
  platform: 'TikTok',
  icon: Music2,
  location: 'Pine Bluff, Little Rock, NLR, Sherwood, Cabot, Maumelle + 20-mile radius',
  demographics: 'Age 21–40, all genders',
  interests: 'Food & beverage, entertainment, side hustle, gig economy, driving',
  budget: '$15–25/day per ad group, 7-day test',
};

const GOOGLE_TARGETING = {
  platform: 'Google Search & Display',
  icon: Search,
  location: 'All 7 live towns + 20-mile radius around each',
  demographics: 'Age 21+ (Google auto-restricts under 21)',
  keywords: 'delivery driver jobs, alcohol delivery driver, part time delivery, gig jobs near me',
  budget: '$20–30/day search, $10–15/day display',
};

export default function DriverAdCampaign() {
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
      const res = await base44.functions.invoke('sendDriverRecruitmentBlast', {});
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

  const renderImageAd = (ad, platform) => (
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
            <Button size="sm" variant="outline" onClick={() => downloadImage(ad.image, `driver-ad-${platform}-${ad.id}.png`)}>
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          )}
        </div>
      </div>
    </Card>
  );

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
            <h1 className="text-2xl font-display font-bold">Driver Recruitment Campaign</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Heavy multi-platform ad blitz targeting drivers 21+ in all {LIVE_TOWNS.length} towns where liquor stores are live.
          </p>
        </div>
        <Button onClick={sendEmailBlast} disabled={sendingBlast} size="lg" className="rounded-xl h-12 px-6">
          {sendingBlast ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {sendingBlast ? 'Sending...' : 'Send Email Blast'}
        </Button>
      </div>

      {/* Campaign Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={MapPin} label="Live Towns" value={String(LIVE_TOWNS.length)} color="text-primary" />
        <StatCard icon={Car} label="Live Stores" value={String(LIVE_TOWNS.reduce((s, t) => s + t.stores, 0))} color="text-secondary" />
        <StatCard icon={DollarSign} label="Pay Per Delivery" value="$4.75" color="text-emerald-600" />
        <StatCard icon={Users} label="Platforms" value="8" color="text-primary" />
      </div>

      {/* Live Towns Banner */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-secondary" />
          <h2 className="font-display font-bold text-lg">🎯 Targeting {LIVE_TOWNS.length} Live Towns</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {LIVE_TOWNS.map(town => (
            <Badge key={town.city} variant="secondary" className="text-sm py-1.5 px-3">
              <MapPin className="w-3 h-3 mr-1" />
              {town.city} · {town.county} County · {town.stores} store{town.stores > 1 ? 's' : ''}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Facebook Feed Ads — one per town */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Facebook className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Facebook Feed Ads — City-Targeted</h2>
          <span className="text-xs text-muted-foreground">One ad per live town ({FACEBOOK_ADS.length} ads)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FACEBOOK_ADS.map(ad => renderImageAd(ad, 'facebook'))}
        </div>
      </div>

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
          <span className="text-xs text-muted-foreground">({GOOGLE_SEARCH_ADS.length} ad groups — geo-targeted by city)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-sm font-semibold">One-Click Driver Recruitment Blast</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sends to all registered users & early signups. Email highlights $4.75/delivery pay, Beverage King launch, free ABC certification, and requirements checklist.
              </p>
              <p className="text-xs text-muted-foreground mt-1"><strong>Current subject:</strong> {EMAIL_SUBJECTS[0]}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">A/B Test Subject Lines</p>
            {EMAIL_SUBJECTS.map((subject, i) => (
              <CopyField key={i} label={`Option ${i + 1}`} text={subject} id={`driver_email_sub_${i}`} copiedId={copiedId} onCopy={copyText} />
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
              <CopyField label={`Message ${i + 1} (${msg.length} chars)`} text={msg} id={`driver_sms_${i}`} copiedId={copiedId} onCopy={copyText} multiline />
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
                        <Icon className="w-3.5 h-3.5 text-primary" /> FB/IG · {t.town}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{t.location}</td>
                    <td className="p-3 text-muted-foreground">{t.demographics}</td>
                    <td className="p-3 text-muted-foreground">{t.interests}</td>
                    <td className="p-3 text-muted-foreground font-medium">{t.budget}</td>
                  </tr>
                );
              })}
              <tr className="border-b hover:bg-muted/30">
                <td className="p-3"><div className="flex items-center gap-1.5 font-semibold"><Music2 className="w-3.5 h-3.5 text-primary" /> {TIKTOK_TARGETING.platform}</div></td>
                <td className="p-3 text-muted-foreground">{TIKTOK_TARGETING.location}</td>
                <td className="p-3 text-muted-foreground">{TIKTOK_TARGETING.demographics}</td>
                <td className="p-3 text-muted-foreground">{TIKTOK_TARGETING.interests}</td>
                <td className="p-3 text-muted-foreground font-medium">{TIKTOK_TARGETING.budget}</td>
              </tr>
              <tr className="border-b hover:bg-muted/30">
                <td className="p-3"><div className="flex items-center gap-1.5 font-semibold"><Search className="w-3.5 h-3.5 text-primary" /> {GOOGLE_TARGETING.platform}</div></td>
                <td className="p-3 text-muted-foreground">{GOOGLE_TARGETING.location}</td>
                <td className="p-3 text-muted-foreground">{GOOGLE_TARGETING.demographics}</td>
                <td className="p-3 text-muted-foreground">{GOOGLE_TARGETING.keywords}</td>
                <td className="p-3 text-muted-foreground font-medium">{GOOGLE_TARGETING.budget}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Card className="p-4 mt-3 bg-muted/30">
          <p className="text-sm font-semibold mb-1 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600" /> Estimated Total Daily Budget</p>
          <p className="text-sm text-muted-foreground">
            ~${(LIVE_TOWNS.length * 20 + 25 + 20 + 15 + 10).toLocaleString()}/day across all platforms ({LIVE_TOWNS.length} town-level FB/IG ad sets + TikTok + Google Search + Google Display). Run for 7 days = ~${((LIVE_TOWNS.length * 20 + 25 + 20 + 15 + 10) * 7).toLocaleString()} total.
          </p>
        </Card>
      </div>

      {/* Launch Checklist */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-display font-bold">Campaign Launch Checklist</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {[
            'Download the driver ad image from each section',
            'Set up Facebook Ads Manager — create 7 ad sets, one per live town',
            'Geo-target each FB ad set to its town + 15-mile radius (age 21+)',
            'Create Instagram ad set — reuse FB images in Story + Feed format',
            'Set up TikTok Ads Manager — upload 9:16 videos/images',
            'Create Twitter/X promoted posts with copy above',
            `Build ${GOOGLE_SEARCH_ADS.length} Google Search ad groups with city keywords`,
            'Set up Google Display responsive ads with driver image',
            'Send email blast to all existing contacts (button above)',
            'Schedule SMS campaign (if using SMS provider)',
            'Set daily budgets: $15–25/day per town-level ad set',
            'Monitor 3–5 days, pause underperformers, scale winners',
            'Use UTM links to track signups per platform per town',
            'Retarget ad engagement with a follow-up "Still Hiring" creative on day 5',
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