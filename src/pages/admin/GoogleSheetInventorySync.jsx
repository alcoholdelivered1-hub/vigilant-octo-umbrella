import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, RefreshCw, Clock, Zap, Save } from 'lucide-react';

export default function GoogleSheetInventorySync() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Auto-sync config state
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [autoToggleLoading, setAutoToggleLoading] = useState(false);

  useEffect(() => {
    base44.entities.InventorySyncConfig.list('-created_date', 1)
      .then(configs => {
        if (configs[0]) setConfig(configs[0]);
        setConfigLoading(false);
      })
      .catch(() => setConfigLoading(false));
  }, []);

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

  const handleSaveConfig = async () => {
    if (!sheetUrl.trim()) {
      setError('Enter a Google Sheet URL before saving the auto-sync config');
      return;
    }
    setSavingConfig(true);
    setError('');
    try {
      const payload = {
        spreadsheet_url: sheetUrl.trim(),
        sheet_name: sheetName.trim() || null,
      };
      if (config) {
        await base44.entities.InventorySyncConfig.update(config.id, payload);
      } else {
        const created = await base44.entities.InventorySyncConfig.create({
          ...payload,
          is_active: true,
          sync_interval_minutes: 15,
        });
        setConfig(created);
      }
      setConfig(c => c ? { ...c, ...payload } : { ...payload, is_active: true, sync_interval_minutes: 15 });
    } catch (e) {
      setError(e.message);
    }
    setSavingConfig(false);
  };

  const handleToggleAutoSync = async () => {
    if (!config) return;
    setAutoToggleLoading(true);
    try {
      await base44.entities.InventorySyncConfig.update(config.id, { is_active: !config.is_active });
      setConfig({ ...config, is_active: !config.is_active });
    } catch (e) {
      setError(e.message);
    }
    setAutoToggleLoading(false);
  };

  const formatDate = (iso) => {
    if (!iso) return 'Never';
    try { return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
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
          Connect a Google Sheet where retailers update prices and stock. The app auto-syncs every 15 minutes so customers always see current prices.
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

      {/* Auto-Sync Configuration */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Automatic Sync</h2>
          </div>
          {config && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{config.is_active ? 'Enabled' : 'Disabled'}</span>
              <Switch
                checked={config.is_active}
                onCheckedChange={handleToggleAutoSync}
                disabled={autoToggleLoading}
              />
            </div>
          )}
        </div>

        {configLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading configuration…
          </div>
        ) : (
          <>
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

            <Button onClick={handleSaveConfig} disabled={savingConfig || !sheetUrl.trim()} variant="outline" className="rounded-xl">
              {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {config ? 'Update Auto-Sync Source' : 'Enable Auto-Sync'}
            </Button>

            {config && (
              <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Last auto-sync: <strong className="text-foreground">{formatDate(config.last_synced_at)}</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground text-xs mt-0.5">Status:</span>
                  {config.last_sync_status === 'success' && (
                    <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {config.last_sync_summary || 'Success'}
                    </span>
                  )}
                  {config.last_sync_status === 'error' && (
                    <span className="text-xs text-red-700 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {config.last_sync_summary || 'Error'}
                    </span>
                  )}
                  {config.last_sync_status === 'pending' && (
                    <span className="text-xs text-muted-foreground">Waiting for first sync…</span>
                  )}
                </div>
                {config.is_active && (
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Syncs automatically every 15 minutes. Retailers just edit the sheet — prices update on their own.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Manual Sync (one-off) */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" /> Manual Sync (One-Off)
        </h2>
        <p className="text-xs text-muted-foreground">
          Run an immediate sync from any sheet URL — useful for testing or a one-time import. Uses the URL above.
        </p>

        <div className="flex items-center gap-2">
          <Checkbox id="dry-run" checked={dryRun} onCheckedChange={(v) => setDryRun(!!v)} />
          <Label htmlFor="dry-run" className="text-sm font-normal cursor-pointer">
            Dry run — preview changes without updating
          </Label>
        </div>

        <Button onClick={handleSync} disabled={loading || !sheetUrl.trim()} className="w-full rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {loading ? 'Syncing…' : dryRun ? 'Preview Changes' : 'Sync Now'}
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
          Your Google Sheet must have a header row. Products are matched by store + product name + brand + pack size.
        </p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {[
            ['store_name', 'Store name (must match an existing store)'],
            ['store_id', 'Or use the store ID (takes priority)'],
            ['product_name', 'Product name (required for matching)'],
            ['brand', 'Brand name (used in match key)'],
            ['pack_size', 'Package type: Single, 6-Pack, 12-Pack, etc.'],
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