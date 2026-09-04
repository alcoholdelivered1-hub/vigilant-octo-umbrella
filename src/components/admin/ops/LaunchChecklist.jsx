import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function LaunchChecklist({ checklist }) {
  const doneCount = checklist.filter((c) => c.done).length;
  const pct = Math.round((doneCount / checklist.length) * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Launch Checklist</CardTitle>
        <span className={cn('text-sm font-semibold', pct >= 90 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-600')}>
          {doneCount}/{checklist.length} complete
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2">
          {checklist.map((c) => (
            <div key={c.label} className={cn('flex items-start gap-3 rounded-lg border p-3', c.done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200')}>
              {c.done
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                : <Circle className="h-5 w-5 text-amber-500 shrink-0" />}
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}