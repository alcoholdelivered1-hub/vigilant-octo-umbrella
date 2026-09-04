import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, Store, Package } from 'lucide-react';

const CSV_TEMPLATE = `store_id,store_name,license_number,address,city,county,state,zip_code,phone,email,latitude,longitude,operating_hours_start,operating_hours_end,product_name,category,brand,price,volume,abv,stock_quantity,in_stock
STORE001,Pine Bluff Liquor,12345,123 Main St,Pine Bluff,Jefferson,AR,71601,(870)555-1234,store1@example.com,34.2250,-92.0000,07:00,22:00,Budweiser 12pk,beer,Budweiser,14.99,12oz,5.0,150,true
STORE001,Pine Bluff Liquor,12345,123 Main St,Pine Bluff,Jefferson,AR,71601,(870)555-1234,store1@example.com,34.2250,-92.0000,07:00,22:00,Jack Daniels,spirits,Jack Daniels,24.99,750ml,40.0,45,true`;

export default function StoreInventorySync() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = async (f) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.zip')) {
      setError('Only .csv and .zip files are supported');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File must be under 50 MB');
      return;
    }
    setError('');
    setResult(null);
    setFile(f);
    // Auto-sync immediately on file selection
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await base44.functions.invoke('uploadAndSyncInventory', formData);
      const data = res.data;
      if (!data.success) throw new Error(data.error || 'Sync failed');
      setResult(data.summary);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Upload className="w-7 h-7 text-primary" /> Store Inventory Sync
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a CSV or ZIP file to create/update stores and their product inventory.
        </p>
      </div>

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-800">Need a template?</p>
          <p className="text-xs text-blue-700 mt-0.5">Download the CSV template with all required columns pre-filled.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
          <FileText className="w-4 h-4 mr-1.5" /> Download Template
        </Button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.zip"
          className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-foreground">Drop your file here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">CSV or ZIP • Max 50 MB • All 98 stores in one file</p>
      </div>

      {/* Selected file */}
      {file && (
        <div className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button onClick={() => { setFile(null); setResult(null); setError(''); }} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-primary font-medium">
          <Loader2 className="w-5 h-5 animate-spin" /> Syncing inventory…
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-700 font-semibold">
            <CheckCircle2 className="w-5 h-5" /> Sync completed successfully!
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Stores</p>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-bold text-emerald-600">{result.stores.created}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="font-bold text-blue-600">{result.stores.updated}</span></div>
              </div>
            </div>

            <div className="bg-card border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-secondary" />
                <p className="font-semibold text-sm">Products</p>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-bold text-emerald-600">{result.products.created}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="font-bold text-blue-600">{result.products.updated}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unchanged</span><span className="font-bold text-muted-foreground">{result.products.skipped}</span></div>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">{result.total_rows} total rows processed</p>

          {result.errors?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {result.errors.length} rows had errors
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
            ['store_id', 'Unique store identifier (required)'],
            ['store_name', 'Store display name'],
            ['license_number', 'ABC license number'],
            ['address', 'Street address'],
            ['city', 'City'],
            ['county', 'County name'],
            ['state', 'State (defaults to AR)'],
            ['zip_code', 'ZIP code'],
            ['phone', 'Phone number'],
            ['email', 'Store contact email'],
            ['latitude', 'GPS latitude'],
            ['longitude', 'GPS longitude'],
            ['operating_hours_start', 'Opening time e.g. 07:00'],
            ['operating_hours_end', 'Closing time e.g. 22:00'],
            ['product_name', 'Product name (required for products)'],
            ['category', 'beer / wine / spirits / mixers'],
            ['brand', 'Brand name'],
            ['price', 'Price in USD'],
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