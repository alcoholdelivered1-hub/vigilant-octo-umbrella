import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Image, CheckCircle2, Loader2, Database, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import LowStockDashboard from '@/components/admin/LowStockDashboard';

export default function ProductSync() {
  const [tab, setTab] = useState('sync');
  const [syncing, setSync] = useState(false);
  const [imaging, setImaging] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const { data: products = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const noImageCount = products.filter(p => !p.image_url).length;
  const withImageCount = products.filter(p => p.image_url).length;

  const handleSync = async () => {
    setSync(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke('syncProductsFromCSV', {});
      setSync(false);
      if (res.data?.success) {
        setSyncResult(res.data.summary);
        toast.success('Product sync complete!');
      } else if (res.data?.error?.includes('not a valid URL') || res.data?.error?.includes('not set')) {
        setSyncResult({ needsConfig: true });
      } else {
        toast.error(res.data?.error || 'Sync failed');
      }
    } catch (err) {
      setSync(false);
      setSyncResult({ needsConfig: true });
    }
  };

  const handleGenerateImages = async () => {
    setImaging(true);
    try {
      await base44.functions.invoke('generateProductImages', {});
      setImaging(false);
      toast.success('Product image generation started! Check back in a few minutes.');
    } catch (error) {
      setImaging(false);
      toast.error(error.message || 'Image generation failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Product Sync & Inventory</h1>
        <p className="text-muted-foreground mt-1">Manage product catalog, stock levels, and low-stock alerts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        <button onClick={() => setTab('sync')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'sync' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Database className="w-4 h-4 inline mr-1.5 -mt-0.5" />Catalog Sync
        </button>
        <button onClick={() => setTab('stock')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'stock' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <AlertTriangle className="w-4 h-4 inline mr-1.5 -mt-0.5" />Low Stock Alerts
        </button>
      </div>

      {tab === 'stock' && <LowStockDashboard />}

      {tab === 'sync' && <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold">{products.length}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Products</p>
        </div>
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600">{withImageCount}</p>
          <p className="text-sm text-muted-foreground mt-1">With Images</p>
        </div>
        <div className="bg-card border rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{noImageCount}</p>
          <p className="text-sm text-muted-foreground mt-1">Missing Images</p>
        </div>
      </div>

      {/* CSV Sync */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">Weekly CSV Price Sync</h2>
            <p className="text-sm text-muted-foreground">Auto-runs every Monday at 6am. Trigger manually below.</p>
          </div>
        </div>
        <Button onClick={handleSync} disabled={syncing} className="w-full rounded-xl h-11">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {syncing ? 'Syncing...' : 'Run CSV Sync Now'}
        </Button>
        {syncResult && !syncResult.needsConfig && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Sync Complete</p>
            <p className="text-emerald-700">Stores: {syncResult.stores} · CSV products: {syncResult.products_in_csv}</p>
            <p className="text-emerald-700">Created: {syncResult.created} · Updated: {syncResult.updated} · Unchanged: {syncResult.skipped}</p>
          </div>
        )}
        {syncResult && syncResult.needsConfig && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-1">
            <p className="font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> CSV URL Not Configured</p>
            <p className="text-amber-700">To use CSV sync, add a valid CSV file URL in <strong>Settings → Environment Variables</strong> under <code className="bg-amber-100 px-1 rounded">PRODUCTS_CSV_URL</code>.</p>
            <p className="text-amber-700">This should be a direct link to a .csv file (e.g., a Google Sheets export link ending in <code className="bg-amber-100 px-1 rounded">export?format=csv</code>).</p>
          </div>
        )}
      </div>

      {/* Image Generation */}
      <div className="bg-card border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Image className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-semibold">AI Product Images</h2>
            <p className="text-sm text-muted-foreground">Generate product photos for items missing images.</p>
          </div>
        </div>

        {noImageCount > 0 ? (
          <Button onClick={handleGenerateImages} disabled={imaging} className="w-full rounded-xl h-11">
            {imaging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Image className="w-4 h-4 mr-2" />}
            {imaging ? 'Generating Images...' : `Generate Images for ${noImageCount} Products`}
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium py-2">
            <CheckCircle2 className="w-4 h-4" /> All products have images
          </div>
        )}

        {imaging && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <p>🔄 Image generation in progress. This may take several minutes.</p>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}