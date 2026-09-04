import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StarRating — interactive or display-only star widget.
 * Props:
 *  - value: current rating (number)
 *  - onChange: (rating) => void  — if omitted, renders read-only
 *  - size: 'sm' | 'md' | 'lg'  — defaults to 'md'
 *  - showValue: show numeric average next to stars
 *  - count: number of ratings (shown when showValue=true)
 */
export default function StarRating({ value = 0, onChange, size = 'md', showValue = false, count }) {
  const [hovered, setHovered] = useState(0);
  const readonly = !onChange;

  const sizes = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-7 h-7' };
  const iconClass = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn('transition-colors focus:outline-none', readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform')}
        >
          <Star
            className={cn(
              iconClass,
              s <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-muted-foreground/30'
            )}
          />
        </button>
      ))}
      {showValue && value > 0 && (
        <span className="text-sm font-semibold text-foreground ml-1">
          {value.toFixed(1)}
          {count !== undefined && (
            <span className="text-xs font-normal text-muted-foreground ml-1">({count})</span>
          )}
        </span>
      )}
      {showValue && value === 0 && (
        <span className="text-xs text-muted-foreground ml-1">No ratings yet</span>
      )}
    </div>
  );
}