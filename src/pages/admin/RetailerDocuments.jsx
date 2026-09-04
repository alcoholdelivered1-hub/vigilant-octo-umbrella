import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FolderOpen, CheckCircle2 } from 'lucide-react';
import DocumentSlot from '@/components/admin/DocumentSlot';

const DOC_TYPES = [
  { type: 'retailer_agreement', label: 'Retailer Agreement.pdf' },
  { type: 'abc_license', label: 'ABC License.pdf' },
  { type: 'clover_authorization', label: 'Clover Authorization.pdf' },
  { type: 'stripe_connect', label: 'Stripe Connect.pdf' },
  { type: 'insurance', label: 'Insurance.pdf' },
  { type: 'store_profile', label: 'Store Profile.pdf' },
  { type: 'go_live_checklist', label: 'Go-Live Checklist.pdf' },
];

export default function RetailerDocuments() {
  const [selectedStoreId, setSelectedStoreId] = useState('');

  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ['admin-stores-for-docs'],
    queryFn: () => base44.entities.Store.list('-created_date', 100),
  });

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ['retailer-documents', selectedStoreId],
    queryFn: () => base44.entities.RetailerDocument.filter({ store_id: selectedStoreId }),
    enabled: !!selectedStoreId,
  });

  const selectedStore = stores?.find(s => s.id === selectedStoreId);
  const docMap = new Map((docs || []).map(d => [d.document_type, d]));
  const verifiedCount = DOC_TYPES.filter(dt => docMap.get(dt.type)?.status === 'verified').length;
  const uploadedCount = DOC_TYPES.filter(dt => docMap.get(dt.type)?.file_uri).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <FolderOpen className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Retailer Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload and track onboarding documents for each retailer.
          </p>
        </div>
      </div>

      {/* Store Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Retailer</label>
        <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
          <SelectTrigger><SelectValue placeholder="Choose a store…" /></SelectTrigger>
          <SelectContent>
            {storesLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              stores?.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} — {s.city || 'No city'}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Document List */}
      {selectedStoreId ? (
        docsLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <CheckCircle2 className={`w-5 h-5 ${verifiedCount === 7 ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {verifiedCount} of 7 verified
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploadedCount} uploaded
                </p>
              </div>
              {verifiedCount === 7 && (
                <span className="text-xs font-semibold text-emerald-600">Ready for go-live</span>
              )}
            </div>

            <div className="space-y-2.5">
              {DOC_TYPES.map(dt => (
                <DocumentSlot
                  key={dt.type}
                  doc={docMap.get(dt.type)}
                  storeId={selectedStoreId}
                  storeName={selectedStore?.name || ''}
                  docLabel={dt.label}
                  docType={dt.type}
                />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Select a retailer above to manage their documents.</p>
        </div>
      )}
    </div>
  );
}