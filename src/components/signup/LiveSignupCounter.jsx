import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Loader2 } from 'lucide-react';

export default function LiveSignupCounter() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = () => {
      base44.functions.invoke('getSignupStats', {})
        .then(res => {
          if (!cancelled && res.data) setCount(res.data.total_signups);
        })
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (count === null) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-full px-4 py-2">
      <Users className="w-4 h-4 text-primary" />
      <span className="text-sm font-semibold text-foreground">
        <span className="text-primary tabular-nums">{count.toLocaleString()}</span>
        <span className="text-muted-foreground font-normal"> {count === 1 ? 'person has' : 'people have'} already joined</span>
      </span>
      <span className="flex gap-0.5">
        {[...Array(3)].map((_, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </span>
    </div>
  );
}