import React, { useState } from 'react';
import { Download, Copy, Check, Wine, Car, Smartphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

const AD_CREATIVES = [
  {
    id: 'customer_product',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/0fc687275_generated_image.png',
    audience: 'Customers',
    icon: Wine,
    platform: 'Facebook Feed',
    headline: 'Your Favorite Drinks, Delivered.',
    primary_text: 'Beer, wine, and spirits delivered to your door in under 45 minutes. Fully licensed, ID-verified, and locally owned in Pine Bluff, AR. Free 30-day trial — no monthly fee for your first month. $3 flat delivery fee, no surge pricing. Order now →',
    cta: 'Shop Now',
  },
  {
    id: 'driver_recruit',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/1df2ab70b_generated_image.png',
    audience: 'Drivers',
    icon: Car,
    platform: 'Facebook Feed',
    headline: 'Earn Money on Your Schedule',
    primary_text: 'Become a delivery driver for Alcohol Delivered by SipSwift. $4.75 per delivery + 100% of your tips + $1/mile bonus for long deliveries. Free alcohol safety training included. Flexible hours — drive when you want. We are actively recruiting across Pulaski, Jefferson, Arkansas, and Cleveland Counties — including Little Rock, North Little Rock, Sherwood, Maumelle, Pine Bluff, Stuttgart, and Rison. Apply today →',
    cta: 'Apply Now',
  },
  {
    id: 'driver_recruit_little_rock',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/1df2ab70b_generated_image.png',
    audience: 'Drivers',
    icon: Car,
    platform: 'Facebook Feed',
    headline: 'Drive & Earn in Little Rock',
    primary_text: 'Looking for flexible income in Little Rock, North Little Rock, or Sherwood? Deliver alcohol for Alcohol Delivered by SipSwift — $4.75 per delivery + 100% of tips + $1/mile bonus for long deliveries. Free ABC certification. Drive when you want. Apply today →',
    cta: 'Apply Now',
  },
  {
    id: 'driver_recruit_pine_bluff',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/1df2ab70b_generated_image.png',
    audience: 'Drivers',
    icon: Car,
    platform: 'Facebook Feed',
    headline: 'Earn Money Driving in Pine Bluff',
    primary_text: 'Pine Bluff drivers needed! Deliver alcohol on your schedule — $4.75 per delivery + 100% of tips + $1/mile bonus. Free training, weekly payouts, no startup costs. Serving Pine Bluff, White Hall, and all of Jefferson County. Apply now →',
    cta: 'Apply Now',
  },
  {
    id: 'driver_recruit_stuttgart',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/1df2ab70b_generated_image.png',
    audience: 'Drivers',
    icon: Car,
    platform: 'Facebook Feed',
    headline: 'Drive & Earn in Stuttgart & Rison',
    primary_text: 'Flexible delivery work in Arkansas County and Cleveland County! Deliver alcohol for Alcohol Delivered by SipSwift — $4.75 per delivery + 100% tips + $1/mile bonus. Free ABC certification, set your own hours. Serving Stuttgart, DeWitt, and Rison. Apply today →',
    cta: 'Apply Now',
  },
  {
    id: 'customer_social',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/3f88b2a6a_generated_image.png',
    audience: 'Customers',
    icon: Users,
    platform: 'Instagram Story (9:16)',
    headline: 'Party? We Deliver.',
    primary_text: 'Hosting friends? Get beer, wine, and spirits delivered fast. Free 30-day trial for new members. 21+ only. Swipe up to order →',
    cta: 'Swipe Up',
  },
  {
    id: 'customer_app',
    image_url: 'https://media.base44.com/images/public/69cf025b60e5f22c0c72f042/22fac06bb_generated_image.png',
    audience: 'Customers',
    icon: Smartphone,
    platform: 'Facebook Feed',
    headline: 'Tap. Order. Delivered.',
    primary_text: 'Order alcohol from your phone in seconds. Real-time GPS tracking, licensed retailers, ID-verified delivery. Serving Pine Bluff and Jefferson County, AR. Start your free 30-day trial today — just $10/month after. No commitment, cancel anytime. →',
    cta: 'Download',
  },
];

export default function AdCreatives() {
  const [copiedId, setCopiedId] = useState(null);

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

  const customerAds = AD_CREATIVES.filter(a => a.audience === 'Customers');
  const driverAds = AD_CREATIVES.filter(a => a.audience === 'Drivers');

  const renderAdCard = (ad) => {
    const Icon = ad.icon;
    return (
      <Card key={ad.id} className="overflow-hidden">
        <div className="relative">
          <img src={ad.image_url} alt={ad.headline} className="w-full h-64 object-cover" />
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full font-medium">
            {ad.platform}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary">{ad.audience}</span>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Headline</p>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold">{ad.headline}</p>
              <button onClick={() => copyText(ad.headline, ad.id + '_headline')} className="flex-shrink-0 text-muted-foreground hover:text-primary">
                {copiedId === ad.id + '_headline' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Primary Text</p>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{ad.primary_text}</p>
              <button onClick={() => copyText(ad.primary_text, ad.id + '_text')} className="flex-shrink-0 text-muted-foreground hover:text-primary mt-0.5">
                {copiedId === ad.id + '_text' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs bg-secondary/10 text-secondary font-medium px-2.5 py-1 rounded-full">CTA: {ad.cta}</span>
            <Button size="sm" variant="outline" onClick={() => downloadImage(ad.image_url, `ad-${ad.id}.png`)}>
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold">Ad Creative Library</h1>
        <p className="text-sm text-muted-foreground mt-1">Ready-to-use images and copy for your Facebook & Instagram ad campaigns. Download images and copy text directly into Ads Manager.</p>
      </div>

      <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
          <Wine className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Targeting Tips for Pine Bluff, AR</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            • <strong>Customers:</strong> Age 21+, radius 15-20 miles around Pine Bluff (zip codes 71601, 71603, 71611). Interests: beer, wine, spirits, nightlife, tailgating.<br />
            • <strong>Drivers:</strong> Age 21+, radius 30 miles around Little Rock, Pine Bluff, and Stuttgart. Target all four counties: Pulaski (zip codes 72201-72223, 72113-72118, 72120), Jefferson (71601-71603), Arkansas (72160, 72042), Cleveland (71665). Interests: DoorDash, Uber Eats, gig economy, part-time jobs, flexible schedule.<br />
            • <strong>Budget:</strong> Start with $5-10/day per campaign, test for 3-5 days, then scale the winners.
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Wine className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Customer Campaigns</h2>
          <span className="text-xs text-muted-foreground">({customerAds.length} ads)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customerAds.map(renderAdCard)}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Car className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Driver Recruitment Campaigns</h2>
          <span className="text-xs text-muted-foreground">({driverAds.length} ads)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {driverAds.map(renderAdCard)}
        </div>
      </div>

      <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">How to use these creatives:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Download the image by clicking the Download button</li>
          <li>Copy the headline and primary text using the copy buttons</li>
          <li>Go to Facebook Ads Manager → Create new campaign</li>
          <li>Upload the image as your ad creative, paste the headline and text</li>
          <li>Set your targeting per the tips above and set your daily budget</li>
          <li>Use the CTA button label shown on each card</li>
        </ol>
      </div>
    </div>
  );
}