import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, X, Package, RefreshCw
} from 'lucide-react';

const PRODUCT_CSV_TEMPLATE = `product_name,category,brand,price,pack_size,volume,abv,stock_quantity,in_stock
Budweiser,beer,Budweiser,2.99,Single,12oz,5.0,500,true
Budweiser,beer,Budweiser,14.99,6-Pack,12oz,5.0,80,true
Budweiser,beer,Budweiser,24.99,12-Pack,12oz,5.0,40,true
Budweiser,beer,Budweiser,54.99,30-Pack,12oz,5.0,15,true
Budweiser,beer,Budweiser,49.99,Case,12oz,5.0,10,true
Jack Daniels,spirits,Jack Daniels,24.99,Single,750ml,40.0,45,true
Merlot Reserve,wine,Robert Mondavi,18.99,Single,750ml,13.5,30,true`;

export default function StoreInventoryUpload() {
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const { data: stores = [], isLoading: storesLoading } = useQuery({
    queryKey: ['stores-for-upload'],
    queryFn: () => base44.entities.Store.filter({ is_active: true }, 'name', 200),
  });

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  const runSync = async (f, storeId) => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      // Build a FormData with the file and the target store ID
      const formData = new FormData();
      formData.append('file', f);
      formData.append('store_id', storeId);
      const res = await base44.functions.invoke('uploadAndSyncInventory', formData);
      const data = res.data;
      if (!data.success) throw new Error(data.error || 'Sync failed');
      setResult(data.summary);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleFile = async (f) => {
    if (!selectedStoreId) {
      setError('Please select a store first.');
      return;
    }
    const lowerName = f.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      setError('Only .csv and .xlsx files are supported');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File must be under 50 MB');
      return;
    }
    setError('');
    setResult(null);
    setFile(f);
    await runSync(f, selectedStoreId);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const downloadTemplate = () => {
    const blob = new Blob([PRODUCT_CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'INVENTORY_TEMPLATE.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin/inventory-sync" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Package className="w-7 h-7 text-primary" /> Store Inventory Upload
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Select a store, upload your CSV or Excel spreadsheet, and the product catalog updates instantly.
        </p>
      </div>

      {/* Store selector */}
      <div className="bg-card border rounded-2xl p-5 space-y-2">
        <label className="text-sm font-semibold">1. Select a store</label>
        {storesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading stores…
          </div>
        ) : (
          <Select value={selectedStoreId} onValueChange={(v) => { setSelectedStoreId(v); reset(); }}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Choose a retail store…" />
            </SelectTrigger>
            <SelectContent>
              {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.city ? ` — ${s.city}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedStore && (
          <p className="text-xs text-muted-foreground">
            License: {selectedStore.license_number || 'N/A'} &nbsp;·&nbsp; {selectedStore.address}, {selectedStore.city}
          </p>
        )}
      </div>

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-800">2. Download the template</p>
          <p className="text-xs text-blue-700 mt-0.5">Fill in your products, then upload below. No store columns needed.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
          <FileText className="w-4 h-4 mr-1.5" /> INVENTORY_TEMPLATE.csv
        </Button>
      </div>

      {/* Drop zone */}
      <div>
        <p className="text-sm font-semibold mb-2">3. Upload your spreadsheet</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all
            ${!selectedStoreId ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="w-10 h-10 animate-spin" />
              <p className="font-semibold">Syncing inventory…</p>
              <p className="text-sm text-muted-foreground">Updating {selectedStore?.name}'s product catalog</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground">
                {selectedStoreId ? 'Drop your CSV or Excel file here or click to browse' : 'Select a store above first'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">CSV or Excel (.xlsx) · Max 50 MB</p>
            </>
          )}
        </div>
      </div>

      {/* Selected file pill */}
      {file && !loading && (
        <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button onClick={reset} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-5 h-5" /> Catalog updated for {selectedStore?.name}!
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Upload another
            </Button>
          </div>

          <div className="bg-card border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Package className="w-4 h-4 text-secondary" />
              <p className="font-semibold text-sm">Products</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-emerald-600">{result.products.created}</p>
                <p className="text-xs text-emerald-700 mt-0.5">Added</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-600">{result.products.updated}</p>
                <p className="text-xs text-blue-700 mt-0.5">Updated</p>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-2xl font-bold text-muted-foreground">{result.products.skipped}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Unchanged</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">{result.total_rows} rows processed</p>
          </div>

          {result.errors?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {result.errors.length} rows had issues
              </p>
              <ul className="space-y-1">
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
        <p className="font-semibold text-sm mb-3">CSV Column Reference</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {[
            ['product_name', 'Product name (required)'],
            ['category', 'beer / wine / spirits / mixers'],
            ['brand', 'Brand name'],
            ['price', 'Price in USD'],
            ['pack_size', 'Single / 6-Pack / 12-Pack / 18-Pack / 24-Pack / 30-Pack / Case'],
            ['volume', 'e.g. 750ml, 12oz'],
            ['abv', 'Alcohol by volume %'],
            ['stock_quantity', 'Current inventory count'],
            ['in_stock', 'true / false'],
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