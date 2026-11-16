import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Wine } from 'lucide-react';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://sipswift.com';

export default function QRCode() {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(APP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Print controls — hidden when printing */}
      <div className="flex gap-3 mb-10 print:hidden">
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </Button>
        <Button variant="outline" onClick={handleCopy} className="gap-2">
          <Share2 className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy Link'}
        </Button>
      </div>

      {/* Printable card */}
      <div className="w-full max-w-sm bg-card border-2 border-border rounded-3xl p-8 flex flex-col items-center gap-6 shadow-xl print:shadow-none print:border-black print:rounded-none print:max-w-full print:p-12">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
            <Wine className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-2xl font-bold leading-tight">SipSwift</p>
            <p className="text-xs text-muted-foreground">Alcohol Delivered</p>
          </div>
        </div>

        {/* Headline */}
        <div className="text-center space-y-1">
          <h1 className="font-display text-3xl font-bold leading-tight">
            Order Beer,<br />Wine & Spirits
          </h1>
          <p className="text-muted-foreground text-sm">Delivered to your door — fast.</p>
        </div>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-border">
          <QRCodeSVG
            value={APP_URL}
            size={200}
            bgColor="#ffffff"
            fgColor="#1a1a2e"
            level="H"
            includeMargin={false}
          />
        </div>

        {/* CTA */}
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">📱 Scan to order now</p>
          <p className="text-xs text-muted-foreground break-all">{APP_URL}</p>
        </div>

        {/* Legal */}
        <p className="text-xs text-muted-foreground text-center leading-relaxed border-t pt-4 w-full">
          Must be 21+ with valid ID. Available in select areas only.<br />
          Drink responsibly. Arkansas ACT 157 compliant.
        </p>
      </div>

      <style>{`
        @media print {
          body { background: white; }
          header, nav, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
}