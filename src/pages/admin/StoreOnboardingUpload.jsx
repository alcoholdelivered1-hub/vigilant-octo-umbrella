import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, X, Store, RefreshCw, Mail, MailX
} from 'lucide-react';

const STORE_CSV_TEMPLATE = `store_name,license_number,address,city,county,zip_code,phone,email,onboarding_status,onboarding_notes
Pine Bluff Liquor Store,LR-12345,123 Main St,Pine Bluff,Jefferson,71601,8705550100,owner@pinebluffliquor.com,invited,
Delta Wine & Spirits,LR-12346,456 Oak Ave,Pine Bluff,Jefferson,71603,8705550200,,contract_sent,Sent contract 6/15
Jefferson Beverage Co,LR-12347,789 Pine Rd,White Hall,Jefferson,71602,8705550300,info@jeffbevco.com,live,Fully onboarded`;

export default function StoreOnboardingUpload() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const runUpload = async (f) => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', f);
      const res = await base44.functions.invoke('uploadStoreOnboarding', formData);
      const data = res.data;
      if (!data.success) throw new Error(data.error || 'Upload failed');
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleFile = async (f) => {
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
    await runUpload(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const downloadTemplate = () => {
    const blob = new Blob([STORE_CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'STORE_ONBOARDING_TEMPLATE.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  const ONBOARDING_LABELS = {
    invited: 'Invited',
    contract_sent: 'Contract Sent',
    contract_signed: 'Contract Signed',
    inventory_added: 'Inventory Added',
    live: 'Live',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <Link to="/admin/retailer-onboarding" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Store className="w-7 h-7 text-primary" /> Store Onboarding Upload
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a spreadsheet of Jefferson County liquor stores to track contact emails and onboarding status.
        </p>
      </div>

      {/* Template download */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-800">Download the template</p>
          <p className="text-xs text-blue-700 mt-0.5">Fill in your store list, then upload below.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
          <FileText className="w-4 h-4 mr-1.5" /> TEMPLATE
        </Button>
      </div>

      {/* Drop zone */}
      <div>
        <p className="text-sm font-semibold mb-2">Upload your spreadsheet</p>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
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
              <p className="font-semibold">Importing stores…</p>
              <p className="text-sm text-muted-foreground">Creating & updating store records</p>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-foreground">Drop your CSV or Excel file here or click to browse</p>
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
              <CheckCircle2 className="w-5 h-5" /> Stores imported successfully!
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Upload another
            </Button>
          </div>

          {/* Summary stats */}
          <div className="bg-card border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-4 h-4 text-secondary" />
              <p className="font-semibold text-sm">Store Records</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-emerald-600">{result.summary.stores.created}</p>
                <p className="text-xs text-emerald-700 mt-0.5">Added</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-2xl font-bold text-blue-600">{result.summary.stores.updated}</p>
                <p className="text-xs text-blue-700 mt-0.5">Updated</p>
              </div>
              <div className="bg-muted rounded-xl p-3">
                <p className="text-2xl font-bold text-muted-foreground">{result.summary.stores.skipped}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Skipped</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">{result.summary.total_rows} rows processed</p>
          </div>

          {/* Email tracking */}
          <div className="bg-card border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4 h-4 text-secondary" />
              <p className="font-semibold text-sm">Contact Email Tracking</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-3 flex flex-col items-center gap-1">
                <Mail className="w-5 h-5 text-emerald-500" />
                <p className="text-2xl font-bold text-emerald-600">{result.summary.contact_emails.with_email}</p>
                <p className="text-xs text-emerald-700">With Email</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 flex flex-col items-center gap-1">
                <MailX className="w-5 h-5 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600">{result.summary.contact_emails.without_email}</p>
                <p className="text-xs text-amber-700">Missing Email</p>
              </div>
            </div>
          </div>

          {/* Store list with emails */}
          {result.storesWithEmail?.length > 0 && (
            <div className="bg-card border rounded-2xl p-5">
              <p className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-500" /> Stores with Contact Email ({result.storesWithEmail.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.storesWithEmail.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                      {ONBOARDING_LABELS[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.storesWithoutEmail?.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="font-semibold text-sm mb-3 flex items-center gap-1.5 text-amber-800">
                <MailX className="w-4 h-4" /> Stores Missing Email ({result.storesWithoutEmail.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.storesWithoutEmail.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-amber-200/50 last:border-0">
                    <p className="text-sm font-medium text-amber-900 truncate">{s.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 shrink-0">
                      {ONBOARDING_LABELS[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-3">These stores need phone-based outreach to collect their email.</p>
            </div>
          )}

          {result.summary.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
              <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {result.summary.errors.length} rows had issues
              </p>
              <ul className="space-y-1">
                {result.summary.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-700">• {e}</li>
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
            ['store_name', 'Store name (required)'],
            ['license_number', 'Arkansas ABC license number'],
            ['address', 'Street address'],
            ['city', 'City'],
            ['county', 'County (defaults to Jefferson)'],
            ['zip_code', 'ZIP code'],
            ['phone', 'Store phone number'],
            ['email', 'Contact email for onboarding'],
            ['onboarding_status', 'invited / contract_sent / contract_signed / inventory_added / live'],
            ['onboarding_notes', 'Free-text notes on progress'],
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