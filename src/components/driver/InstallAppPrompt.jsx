import React, { useEffect, useState } from 'react';
import { Smartphone, Download, X, Share, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'ad_install_prompt_dismissed';

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  useEffect(() => {
    if (isStandalone || dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [isStandalone, dismissed]);

  // Don't show anything if running as installed app, dismissed, or already installed
  if (isStandalone || installed || dismissed) return null;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // No beforeinstallprompt (iOS Safari) — show instructions
      setShowIOS(true);
      return;
    }
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl p-5 mb-6 overflow-hidden">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-semibold text-base leading-tight">Install the Driver App</h3>
          <p className="text-sm text-primary-foreground/80 mt-0.5">
            Add Alcohol Delivered to your home screen for fast, full-screen access to orders, GPS, and earnings.
          </p>
        </div>
      </div>

      {!showIOS ? (
        <Button
          onClick={handleInstall}
          disabled={installing}
          className="w-full mt-4 bg-white text-primary hover:bg-white/90 font-semibold gap-2"
        >
          <Download className="w-4 h-4" />
          {installing ? 'Installing…' : 'Add to Home Screen'}
        </Button>
      ) : (
        <div className="mt-4 bg-white/10 rounded-xl p-4 space-y-2.5">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Share className="w-4 h-4" /> How to install on iPhone
          </p>
          <ol className="text-sm text-primary-foreground/90 space-y-1 ml-1">
            <li>1. Tap the <span className="font-semibold">Share</span> button at the bottom of Safari.</li>
            <li>2. Scroll and tap <span className="font-semibold">Add to Home Screen</span>.</li>
            <li>3. Tap <span className="font-semibold">Add</span> — the app appears on your home screen.</li>
          </ol>
          <Button onClick={dismiss} variant="ghost" className="w-full text-primary-foreground hover:bg-white/10 mt-1">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Got it
          </Button>
        </div>
      )}
    </div>
  );
}