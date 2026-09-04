import React, { useMemo, useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const selectClass =
  'flex h-11 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Reliable cross-device date-of-birth selector.
 * value is a "YYYY-MM-DD" string (or "" when incomplete); onChange receives
 * the assembled string so callers can keep using new Date(value).
 */
export default function BirthdateInput({ value, onChange }) {
  const initial = value ? value.split('-') : ['', '', ''];
  const [year, setYear] = useState(initial[0] ? Number(initial[0]) : '');
  const [month, setMonth] = useState(initial[1] ? Number(initial[1]) : '');
  const [day, setDay] = useState(initial[2] ? Number(initial[2]) : '');

  // Only re-sync local state when a complete date arrives externally;
  // partial selections emit '' and must NOT wipe what the user just picked.
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const p = value.split('-');
      setYear(Number(p[0]));
      setMonth(Number(p[1]));
      setDay(Number(p[2]));
    }
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list = [];
    for (let yr = currentYear; yr >= 1900; yr--) list.push(yr);
    return list;
  }, [currentYear]);

  const daysInMonth = (mo, yr) => {
    if (!mo || !yr) return 31;
    return new Date(yr, mo, 0).getDate(); // mo is 1-12
  };

  const maxDay = daysInMonth(month, year);
  const days = useMemo(() => {
    const list = [];
    for (let dy = 1; dy <= maxDay; dy++) list.push(dy);
    return list;
  }, [maxDay]);

  const emit = (next) => {
    const ny = next.year ?? year;
    const nm = next.month ?? month;
    let nd = next.day ?? day;
    if (ny && nm && nd && nd > daysInMonth(nm, ny)) nd = daysInMonth(nm, ny);
    // Persist each part locally so a single selection visibly sticks
    setYear(ny);
    setMonth(nm);
    setDay(nd);
    if (ny && nm && nd) {
      onChange(`${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`);
    } else {
      onChange('');
    }
  };

  return (
    <div>
      <Label>Date of Birth *</Label>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <select
          aria-label="Birth month"
          value={month}
          onChange={(e) => emit({ month: Number(e.target.value) })}
          className={selectClass}
        >
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={i} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          aria-label="Birth day"
          value={day}
          onChange={(e) => emit({ day: Number(e.target.value) })}
          className={selectClass}
        >
          <option value="">Day</option>
          {days.map((dy) => (
            <option key={dy} value={dy}>{dy}</option>
          ))}
        </select>
        <select
          aria-label="Birth year"
          value={year}
          onChange={(e) => emit({ year: Number(e.target.value) })}
          className={selectClass}
        >
          <option value="">Year</option>
          {years.map((yr) => (
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
      </div>
    </div>
  );
}