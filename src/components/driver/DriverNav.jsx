import React from 'react';
import { Truck, Search, Map, ListChecks, Home, TrendingUp, DollarSign, BookOpen, ShieldCheck, FolderCheck } from 'lucide-react';

const TAB_GROUPS = [
  {
    group: 'Active Deliveries',
    tabs: [
      { id: 'deliveries', label: 'My Deliveries', Icon: Truck },
      { id: 'available', label: 'Find Orders', Icon: Search },
      { id: 'map', label: 'Route Map', Icon: Map },
    ],
  },
  {
    group: 'Shift Setup',
    tabs: [
      { id: 'checklist', label: 'Pre-Shift', Icon: ListChecks },
      { id: 'welcome', label: 'Home', Icon: Home },
    ],
  },
  {
    group: 'My Account',
    tabs: [
      { id: 'summary', label: 'Summary', Icon: TrendingUp },
      { id: 'earnings', label: 'Earnings', Icon: DollarSign },
      { id: 'documents', label: 'Audit Docs', Icon: FolderCheck },
      { id: 'training', label: 'Training', Icon: BookOpen },
      { id: 'background', label: 'Background Check', Icon: ShieldCheck },
    ],
  },
];

export default function DriverNav({ tab, setTab }) {
  return (
    <nav className="space-y-4 mb-6">
      {TAB_GROUPS.map(({ group, tabs }) => (
        <div key={group}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">{group}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-medium transition-colors ${tab === id ? 'bg-primary text-primary-foreground' : 'bg-card border text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}