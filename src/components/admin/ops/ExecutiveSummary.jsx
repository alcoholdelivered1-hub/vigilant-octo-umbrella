import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Rocket, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function pctColor(p) {
  if (p >= 90) return 'text-emerald-600';
  if (p >= 60) return 'text-amber-600';
  return 'text-red-600';
}
function ringColor(p) {
  if (p >= 90) return 'stroke-emerald-500';
  if (p >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
}

export default function ExecutiveSummary({ data }) {
  const { readiness = 0, done_count = 0, total_checks = 0, blockers = [], priorities = [], system_health = {}, recent_activity = [] } = data || {};
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (readiness / 100) * circ;

  return (
    <div className="space-y-6">
      {/* Top row: readiness + health */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
              <circle cx="70" cy="70" r={r} className="stroke-muted" strokeWidth="12" fill="none" />
              <circle cx="70" cy="70" r={r} className={ringColor(readiness)} strokeWidth="12" fill="none"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
            </svg>
            <div className="-mt-[88px] mb-[36px] text-center">
              <div className={cn('text-4xl font-bold', pctColor(readiness))}>{readiness}%</div>
              <div className="text-xs text-muted-foreground">Launch Ready</div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {done_count} of {total_checks} checklist items complete
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> System Health</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Active Stores', value: `${system_health.active_stores}/${system_health.stores}`, icon: Rocket },
              { label: 'Active Drivers', value: `${system_health.active_drivers}/${system_health.drivers}`, icon: Activity },
              { label: 'Orders Today', value: system_health.orders_today, icon: TrendingUp },
              { label: 'Products', value: system_health.products, icon: CheckCircle2 },
              { label: 'Blockers', value: blockers.length, icon: AlertTriangle },
              { label: 'Checklist Done', value: `${done_count}/${total_checks}`, icon: CheckCircle2 },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><s.icon className="h-3.5 w-3.5" />{s.label}</div>
                <div className="mt-1 text-xl font-semibold">{s.value}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Blockers + Priorities */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" /> Active Blockers</CardTitle></CardHeader>
          <CardContent>
            {blockers.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm"><CheckCircle2 className="h-4 w-4" /> No active blockers — all systems go.</div>
            ) : (
              <ul className="space-y-2">
                {blockers.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Rocket className="h-4 w-4 text-primary" /> Today's Priorities</CardTitle></CardHeader>
          <CardContent>
            {priorities.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm"><CheckCircle2 className="h-4 w-4" /> Nothing blocking — focus on growth.</div>
            ) : (
              <ol className="space-y-2">
                {priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">{i + 1}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ul className="space-y-2">
              {recent_activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm border-b last:border-0 py-1.5">
                  <span className="truncate">{a.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{a.at ? new Date(a.at).toLocaleString() : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}