import React from 'react';
import { Store, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function CityHiveLogin() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
            <Store className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">CityHive Merchant Login</h1>
          <p className="text-sm text-muted-foreground">
            Access your CityHive merchant portal to manage your inventory, orders, and storefront.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-sm">
          <Button
            className="w-full"
            size="lg"
            onClick={() => window.open('https://merchants.cityhive.net/', '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4" />
            Go to CityHive Merchant Portal
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open('https://onboarding.cityhive.net/login', '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4" />
            CityHive Onboarding Login
          </Button>
        </div>

        <div className="rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">What is CityHive?</p>
          <p>
            CityHive is an all-in-one digital commerce platform for wine, beer, and spirits retailers.
            It connects your POS, builds your custom website and mobile app, and reaches new customers online.
          </p>
        </div>

        <div className="text-center">
          <Link to="/login" className="inline-flex items-center gap-1 text-sm text-primary underline">
            <ArrowLeft className="w-3 h-3" /> Back to Alcohol Delivered login
          </Link>
        </div>
      </div>
    </div>
  );
}