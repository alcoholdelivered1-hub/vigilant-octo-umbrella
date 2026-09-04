import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Printer, ExternalLink, FileText, Search, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const SOURCE_URL = 'https://www.dfa.arkansas.gov/office/alcohol-beverage-control/permit-changes/';

export default function AbcPermitReports() {
  const [query, setQuery] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['abc-permit-reports'],
    queryFn: async () => {
      const res = await base44.functions.invoke('fetchAbcPermitReports', {});
      return res.data;
    },
  });

  const reports = data?.reports || [];

  const filtered = useMemo(() => {
    if (!query.trim()) return reports;
    const q = query.toLowerCase();
    return reports.filter((r) => r.label.toLowerCase().includes(q));
  }, [reports, query]);

  const byYear = useMemo(() => {
    const map = {};
    filtered.forEach((r) => {
      const y = r.year || 'Unknown';
      if (!map[y]) map[y] = [];
      map[y].push(r);
    });
    return Object.entries(map).sort((a, b) => {
      if (a[0] === 'Unknown') return 1;
      if (b[0] === 'Unknown') return -1;
      return Number(b[0]) - Number(a[0]);
    });
  }, [filtered]);

  const openAndPrint = (url) => {
    // Opens the PDF in a new tab — the browser's built-in PDF viewer has a Print button.
    // The user selects the LaserJet Pro MFP M130fw in the print dialog.
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold">ABC Permit Change Reports</h1>
        <p className="text-muted-foreground mt-1">
          Arkansas DFA Alcoholic Beverage Control — monthly permit changes (new permits, transfers, revocations, closures, non-renewals).
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-blue-900">
          <p className="font-medium">Printing to your LaserJet Pro MFP M130fw</p>
          <p className="text-blue-800/80 mt-0.5">
            Click <strong>Open &amp; Print</strong> on any report — the PDF opens in a new tab, then use the viewer's print button and select your LaserJet in the dialog. The DFA site publishes reports back to ~2021; earlier years (1976–2020) are not available online and must be requested from ABC directly.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by month or year (e.g. June 2025)…"
          className="pl-9"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="font-medium text-destructive">Couldn't load reports</p>
          <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-block mt-3">
            <Button variant="outline" size="sm">Open DFA site directly <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Button>
          </a>
        </div>
      )}

      {/* Reports grouped by year */}
      {!isLoading && !error && (
        <>
          <p className="text-sm text-muted-foreground">
            {data?.count ?? 0} reports available · filtered to {filtered.length}
          </p>

          {byYear.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">No reports match your search.</div>
          ) : (
            <div className="space-y-8">
              {byYear.map(([year, items]) => (
                <div key={year}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-display text-xl font-bold">{year}</h2>
                    <span className="text-xs text-muted-foreground">{items.length} report{items.length !== 1 ? 's' : ''}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((r) => (
                      <div key={r.url} className="border rounded-xl p-4 bg-card flex flex-col gap-3 hover:border-primary/40 transition-colors">
                        <div className="flex items-start gap-2">
                          <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight">{r.month || r.label}</p>
                            <p className="text-xs text-muted-foreground">Permit Changes · PDF</p>
                          </div>
                        </div>
                        <Button size="sm" className="w-full" onClick={() => openAndPrint(r.url)}>
                          <Printer className="w-3.5 h-3.5 mr-1.5" /> Open &amp; Print
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Source link */}
      <div className="text-center pt-4">
        <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5">
          Source: Arkansas DFA — Alcoholic Beverage Control <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}