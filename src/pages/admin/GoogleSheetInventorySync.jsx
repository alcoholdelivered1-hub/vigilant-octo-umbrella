import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function GoogleSheetInventorySync() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSync = async () => {
    if (!sheetUrl.trim()) {
      setError('Please paste a Google Sheet URL or ID');
      return;
    }
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await base44.functions.invoke('syncInventoryFromGoogleSheet', {
        spreadsheet_url: sheetUrl.trim(),
        sheet_name: sheetName.trim() || null,
        dry_run: dryRun,
      });
      if (!res.data.success) throw new Error(res.data.error || 'Sync failed');
      setResult(res.data.summary);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-primary" /> Google Sheet Inventory Sync
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste a Google Sheet link to bulk-update product pricing and stock levels across all stores.
        </p>
      </div>

      {/* Connection status */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Google Sheets connected</p>
          <p className="text-xs text-emerald-700">Your Google account is authorized to read spreadsheet data.</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sheet-url">Google Sheet URL or ID</Label>
          <Input
            id="sheet-url"
            placeholder="https://docs.google.com/spreadsheets/d/1ABC.../edit"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">Paste the full URL from your browser, or just the spreadsheet ID.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sheet-name">Sheet tab name (optional)</Label>
          <Input
            id="sheet-name"
            placeholder="e.g. Inventory, Sheet1"
            value={sheetName}
            onChange={(e) => setSheetName(e.target.value)}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">Leave blank to use the first tab. If your URL has a gid, it will be used automatically.</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox id="dry-run" checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} />
          <Label htmlFor="dry-run" className="text-sm font-normal cursor-pointer">
            Dry run — preview changes without updating
          </Label>
        </div>

        <Button onClick={handleSync} disabled={loading} className="w-full rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Syncing…' : dryRun ? 'Preview Changes' : 'Sync Inventory'}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            {result.dry_run ? 'Dry run complete — no changes were saved' : 'Sync completed successfully!'}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{result.rows_read}</p>
              <p className="text-xs text-muted-foreground mt-1">Rows Read</p>
            </div>
            <div className="bg-card border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{result.products_updated}</p>
              <p className="text-xs text-muted-foreground mt-1">Products Updated</p>
            </div>
            <div className="bg-card border rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{result.products_not_found}</p>
              <p className="text-xs text-muted-foreground mt-1">Not Found / Skipped</p>
            </div>
          </div>

          {result.errors?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {result.errors.length} notes
              </p>
              <ul className="space-y-1 max-h-48 overflow-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-amber-700">• {e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Column reference */}
      <div className="bg-card border rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3">Required Sheet Columns</p>
        <p className="text-xs text-muted-foreground mb-3">
          Your Google Sheet must have a header row. Products are matched by store + product name + brand.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {[
            ['store_name', 'Store name (must match an existing store)'],
            ['store_id', 'Or use the store ID (takes priority)'],
            ['product_name', 'Product name (required for matching)'],
            ['brand', 'Brand name (used in match key)'],
            ['price', 'New price in USD'],
            ['stock_quantity', 'New inventory count'],
            ['in_stock', 'true / false'],
            ['volume', 'e.g. 750ml, 12oz (optional)'],
            ['abv', 'Alcohol by volume % (optional)'],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-1.5 py-0.5">
              <code className="text-primary font-mono shrink-0">{col}</code>
              <span>— {desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}