import React from 'react';

const STYLES = {
  drivers: {
    icon: '🚚',
    label: 'Drivers',
    bar: 'from-blue-500 to-blue-300',
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  retailers: {
    icon: '🏪',
    label: 'Retailers',
    bar: 'from-emerald-500 to-emerald-300',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  customers: {
    icon: '🛒',
    label: 'Customers',
    bar: 'from-amber-500 to-amber-300',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
};

export default function RoleSectionDivider({ role }) {
  const s = STYLES[role] || STYLES.drivers;
  return (
    <div className={`flex items-center gap-3 my-8 ${s.bg} ${s.border} border-y py-2.5 px-4 rounded-lg`}>
      <span className="text-lg leading-none">{s.icon}</span>
      <span className={`text-xs font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span>
      <div className={`flex-1 h-0.5 bg-gradient-to-r ${s.bar} rounded-full opacity-60`} />
    </div>
  );
}