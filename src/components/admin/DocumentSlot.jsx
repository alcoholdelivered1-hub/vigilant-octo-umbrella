import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Download, CheckCircle2, XCircle, FileText, Clock } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-slate-100 text-slate-600 border-slate-200' },
  uploaded: { label: 'Uploaded', icon: FileText, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  verified: { label: 'Verified', icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' },
};

export default function DocumentSlot({ doc, storeId, storeName, docLabel, docType }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const payload = {
        store_id: storeId,
        store_name: storeName,
        document_type: docType,
        file_uri,
        status: 'uploaded',
        uploaded_at: new Date().toISOString(),
      };
      if (doc?.id) {
        return base44.entities.RetailerDocument.update(doc.id, payload);
      }
      return base44.entities.RetailerDocument.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer-documents', storeId] });
      toast.success(`${docLabel} uploaded`);
    },
    onError: (e) => toast.error('Upload failed: ' + (e?.message || 'unknown error')),
    onSettled: () => setUploading(false),
  });

  const statusMutation = useMutation({
    mutationFn: async (status) => {
      const payload = { status };
      if (status === 'verified') payload.verified_at = new Date().toISOString();
      return base44.entities.RetailerDocument.update(doc.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retailer-documents', storeId] });
      toast.success(`${docLabel} marked ${status}`);
    },
    onError: (e) => toast.error('Update failed: ' + (e?.message || 'unknown error')),
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleDownload = async () => {
    if (!doc?.file_uri) return;
    setDownloading(true);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: doc.file_uri, expires_in: 300 });
      window.open(signed_url, '_blank');
    } catch (e) {
      toast.error('Download failed: ' + (e?.message || 'unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const status = doc?.status || 'pending';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{docLabel}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className={statusCfg.className}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusCfg.label}
          </Badge>
          {doc?.uploaded_at && (
            <span className="text-xs text-muted-foreground">
              {new Date(doc.uploaded_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {doc?.file_uri && (
          <>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              disabled={downloading}
              title="Download"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </Button>
            {status === 'uploaded' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate('verified')}
                disabled={statusMutation.isPending}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </Button>
            )}
            {status === 'verified' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate('rejected')}
                disabled={statusMutation.isPending}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-3.5 h-3.5" />
              </Button>
            )}
            {status === 'rejected' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate('verified')}
                disabled={statusMutation.isPending}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        )}
        <label className="cursor-pointer">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
          </span>
        </label>
      </div>
    </div>
  );
}