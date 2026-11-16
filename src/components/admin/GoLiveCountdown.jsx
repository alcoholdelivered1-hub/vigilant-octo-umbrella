import React, { useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';

const LAUNCH_DATE = new Date('2026-07-15T00:00:00');

function getTimeLeft() {
  const now = new Date();
  const diff = LAUNCH_DATE - now;
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

export default function GoLiveCountdown() {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) {
    return (
      <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white flex items-center gap-4">
        <Rocket className="w-8 h-8 shrink-0" />
        <div>
          <p className="text-xl font-bold font-display">Final Go-Live Checks</p>
          <p className="text-sm text-white/80">Ordering remains paused until the production payment, Clover, tax, and compliance gates pass.</p>
        </div>
      </div>
    );
  }

  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds },
  ];

  return (
    <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <Rocket className="w-6 h-6 shrink-0" />
        <div>
          <p className="font-display text-lg font-bold">Countdown to Launch</p>
          <p className="text-xs text-white/70">Soft Opening · Pine Bluff, AR · July 15, 2026</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {units.map(u => (
          <div key={u.label} className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
            <p className="text-3xl font-bold font-display tabular-nums">{String(u.value).padStart(2, '0')}</p>
            <p className="text-[10px] uppercase tracking-wider text-white/70 mt-1">{u.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}