import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function CloverRevenueChart({ invoices }) {
  const chartData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        label: format(d, 'EEE'),
        revenue: 0,
        count: 0,
      });
    }

    for (const inv of invoices) {
      if (inv.status !== 'paid') continue;
      const invDate = new Date(inv.created);
      invDate.setHours(0, 0, 0, 0);
      const day = days.find(d => d.date.getTime() === invDate.getTime());
      if (day) {
        day.revenue += (inv.total || inv.amount_paid || 0) / 100;
        day.count += 1;
      }
    }

    return days.map(d => ({
      label: d.label,
      date: format(d.date, 'MMM d'),
      revenue: Math.round(d.revenue * 100) / 100,
      count: d.count,
    }));
  }, [invoices]);

  const totalWeek = chartData.reduce((sum, d) => sum + d.revenue, 0);
  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-sm">Clover Revenue — Last 7 Days</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Week Total</p>
          <p className="font-bold text-lg text-emerald-600">
            ${totalWeek.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value, name) => [`$${value.toFixed(2)}`, name === 'revenue' ? 'Revenue' : name]}
            labelFormatter={(label, payload) => {
              const p = payload?.[0]?.payload;
              return p ? `${p.date} · ${p.count} order${p.count !== 1 ? 's' : ''}` : label;
            }}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.revenue === maxRevenue && entry.revenue > 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}