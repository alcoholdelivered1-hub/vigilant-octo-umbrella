import React from 'react';
import { differenceInDays, parseISO, startOfWeek, format } from 'date-fns';
import { BookOpen, Award, AlertTriangle, TrendingUp } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';

function getTrainingStatus(driver) {
  if (!driver.training_completed) return 'none';
  if (!driver.training_completed_date) return 'unknown';
  const age = differenceInDays(new Date(), parseISO(driver.training_completed_date));
  if (age > 365) return 'expired';
  if (age > 300) return 'expiring';
  return 'current';
}

export default function WeeklyTrainingSummary({ drivers }) {
  const active = drivers.filter(d => d.is_active && d.status !== 'suspended');

  const counts = { current: 0, expiring: 0, expired: 0, none: 0, unknown: 0 };
  active.forEach(d => counts[getTrainingStatus(d)]++);

  const compliant = counts.current;
  const total = active.length;
  const rate = total > 0 ? Math.round((compliant / total) * 100) : 0;

  // Group by training week for sparkline
  const weekBuckets = {};
  active.forEach(d => {
    if (!d.training_completed_date) return;
    const week = format(startOfWeek(parseISO(d.training_completed_date)), 'MMM d');
    weekBuckets[week] = (weekBuckets[week] || 0) + 1;
  });
  const weekData = Object.entries(weekBuckets)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .slice(-8);

  const chartData = [{ name: 'Completion', value: rate, fill: rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444' }];

  const statusRows = [
    { label: 'Current (within 1 year)', count: counts.current, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Expiring Soon (< 65 days left)', count: counts.expiring, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Expired (> 1 year ago)', count: counts.expired, color: 'text-red-700 bg-red-50 border-red-200' },
    { label: 'No Training Recorded', count: counts.none, color: 'text-red-700 bg-red-50 border-red-200' },
    { label: 'Date Unknown', count: counts.unknown, color: 'text-muted-foreground bg-muted border' },
  ];

  const auditReady = rate >= 90;

  return (
    <div className="bg-card rounded-2xl border">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Weekly Training Completion Summary
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">ABC-required training audit readiness (ACT 157 §3-4-1106)</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
          auditReady ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {auditReady ? <Award className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {auditReady ? 'Audit Ready' : 'Action Needed'}
        </div>
      </div>

      <div className="p-5 grid md:grid-cols-2 gap-6">
        {/* Radial gauge */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-40 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
                <Tooltip formatter={(v) => `${v}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{rate}%</span>
              <span className="text-xs text-muted-foreground">Compliant</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">{compliant} of {total} active drivers</p>
        </div>

        {/* Status breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Breakdown</p>
          {statusRows.map(row => (
            <div key={row.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${row.color}`}>
              <span>{row.label}</span>
              <span className="font-bold text-sm">{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Training history by week */}
      {weekData.length > 0 && (
        <div className="px-5 pb-5 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Training Completions by Week
          </p>
          <div className="flex items-end gap-2 h-16">
            {weekData.map(([week, count]) => {
              const maxCount = Math.max(...weekData.map(w => w[1]));
              const height = Math.round((count / maxCount) * 100);
              return (
                <div key={week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-primary">{count}</span>
                  <div
                    className="w-full rounded-t-md bg-primary/70 transition-all"
                    style={{ height: `${Math.max(height, 8)}%`, minHeight: 4 }}
                  />
                  <span className="text-[9px] text-muted-foreground text-center leading-tight">{week}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ABC audit note */}
      <div className="mx-5 mb-5 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
        <strong>ABC Audit Readiness:</strong> ACT 157 §3-4-1106 requires 100% of active drivers to have completed the ABC-approved delivery training program before operating. Recommended threshold for audit readiness: ≥90% current.
      </div>
    </div>
  );
}