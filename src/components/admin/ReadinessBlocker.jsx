import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function ReadinessBlocker({ title, current, target, description, linkTo, linkLabel, icon: Icon }) {
  const isMet = current >= target;
  const pct = Math.min(100, Math.round((current / target) * 100));

  return (
    <div className={`bg-card border rounded-2xl p-5 transition-colors ${isMet ? 'border-emerald-200' : 'border-amber-200'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-5 h-5 ${isMet ? 'text-emerald-500' : 'text-amber-500'}`} />}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {isMet
          ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          : <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />}
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className={`text-3xl font-bold ${isMet ? 'text-emerald-600' : 'text-amber-600'}`}>{current}</span>
        <span className="text-sm text-muted-foreground">/ {target} needed</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${isMet ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{description}</p>
      {linkTo && !isMet && (
        <Link to={linkTo} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {linkLabel || 'Fix this'} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}