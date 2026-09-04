import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, trend, className }) {
  return (
    <div className={cn("bg-card rounded-2xl p-5 border shadow-sm", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1 font-medium", trend > 0 ? "text-emerald-600" : "text-red-500")}>
              {trend > 0 ? '+' : ''}{trend}% from last week
            </p>
          )}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}