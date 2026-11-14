import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Monitor } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const POS_LABELS = {
  clover: 'Clover',
  square: 'Square',
  toast: 'Toast',
  ncr: 'NCR / Aloha',
  lightspeed: 'Lightspeed',
  shopkeep: 'ShopKeep',
  other: 'Other',
  none: 'None / Manual',
};

const POS_COLORS = {
  clover: 'bg-emerald-500',
  square: 'bg-blue-500',
  toast: 'bg-orange-500',
  ncr: 'bg-purple-500',
  lightspeed: 'bg-cyan-500',
  shopkeep: 'bg-amber-500',
  other: 'bg-slate-500',
  none: 'bg-gray-400',
};

export default function PosSystemSummary() {
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-pos-summary'],
    queryFn: () => base44.entities.Store.list(),
  });

  const distribution = useMemo(() => {
    const counts = {};
    let unspecified = 0;

    for (const store of stores) {
      if (store.pos_system && POS_LABELS[store.pos_system]) {
        counts[store.pos_system] = (counts[store.pos_system] || 0) + 1;
      } else {
        unspecified++;
      }
    }

    const entries = Object.entries(counts)
      .map(([key, count]) => ({ key, label: POS_LABELS[key], count, color: POS_COLORS[key] }))
      .sort((a, b) => b.count - a.count);

    const totalSpecified = entries.reduce((sum, e) => sum + e.count, 0);

    return { entries, unspecified, total: stores.length, totalSpecified };
  }, [stores]);

  const maxCount = distribution.entries[0]?.count || 1;

  return (
    <div className="bg-card rounded-2xl border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Monitor className="w-4 h-4 text-primary" />
        <h2 className="font-semibold">POS System Distribution</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      ) : distribution.entries.length === 0 && distribution.unspecified === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No stores yet</p>
      ) : (
        <div className="space-y-2.5">
          {distribution.entries.map(({ key, label, count, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs font-medium w-28 shrink-0">{label}</span>
              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                <div
                  className={`h-full ${color} rounded-md transition-all`}
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold w-6 text-right">{count}</span>
            </div>
          ))}

          {distribution.unspecified > 0 && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <span className="text-xs font-medium w-28 shrink-0 text-muted-foreground">Unspecified</span>
              <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                <div
                  className="h-full bg-gray-300 rounded-md transition-all"
                  style={{ width: `${(distribution.unspecified / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold w-6 text-right text-muted-foreground">{distribution.unspecified}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2 border-t mt-3">
            {distribution.totalSpecified} of {distribution.total} stores have specified a POS system
          </p>
        </div>
      )}
    </div>
  );
}