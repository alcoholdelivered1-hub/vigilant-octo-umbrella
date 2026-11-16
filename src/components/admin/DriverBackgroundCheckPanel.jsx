import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ShieldCheck, Upload, Eye, CheckCircle2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS = {
  pending: { label: 'Pending', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  clear: { label: 'Clear (Checkr)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  manual_clear: { label: 'Verified (Manual)', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  failed: { label: 'Failed', color: 'text-red-600 bg-red-50 border-red-200' },
  error: { label: 'Error', color: 'text-red-600 bg-red-50 border-red-200' },
};

export default function DriverBackgroundCheckPanel({ driver }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const statusInfo = STATUS_LABELS[driver.background_check_status] || STATUS_LABELS.pending;

  const runCheckrMutation = useMutation({
    mutationFn: () => base44.functions.invoke('runDriverBackgroundCheck', { driver_id: driver.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
      toast.success('Background check submitted to Checkr');
    },
    onError: (err) => toast.error(err.message || 'Checkr check failed'),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.Driver.update(driver.id, { background_check_file_uri: file_uri });
      return file_uri;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
      toast.success('Background check PDF uploaded (stored privately)');
      setUploading(false);
    },
    onError: (err) => {
      toast.error(err.message || 'Upload failed');
      setUploading(false);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Driver.update(driver.id, {
        background_check_status: 'manual_clear',
        background_check_manual_approved_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers-list'] });
      toast.success(`${driver.name} marked as Verified (Manual)`);
      setOpen(false);
    },
    onError: (err) => toast.error(err.message || 'Approval failed'),
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    uploadMutation.mutate(file);
  };

  const handlePreview = async () => {
    if (!driver.background_check_file_uri) return;
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: driver.background_check_file_uri });
      window.open(signed_url, '_blank');
    } catch (err) {
      toast.error('Could not generate preview link');
    }
  };

  const hasFile = !!driver.background_check_file_uri;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border whitespace-nowrap ${statusInfo.color}`}>
          <ShieldCheck className="w-3 h-3" />
          {statusInfo.label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Background Check — {driver.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Current Status</p>
              <p className={`text-sm font-bold mt-1 px-2 py-0.5 rounded inline-block border ${statusInfo.color}`}>
                {statusInfo.label}
              </p>
            </div>
            {driver.background_check_id && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Checkr ID</p>
                <p className="text-xs font-mono">{driver.background_check_id}</p>
              </div>
            )}
          </div>

          {driver.background_check_completed_at && (
            <p className="text-xs text-muted-foreground">
              Completed: {new Date(driver.background_check_completed_at).toLocaleString()}
            </p>
          )}

          {/* Live Checkr check */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Live Checkr Check</p>
            </div>
            <p className="text-xs text-muted-foreground">Submit a new background check via the Checkr API. Status updates automatically when the report completes.</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={runCheckrMutation.isPending}
              onClick={() => runCheckrMutation.mutate()}
            >
              {runCheckrMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              {runCheckrMutation.isPending ? 'Submitting...' : 'Run Checkr Background Check'}
            </Button>
          </div>

          {/* Manual PDF upload */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Manual PDF Upload</p>
            </div>
            <p className="text-xs text-muted-foreground">Upload an offline background check PDF. Admin can preview and approve it to set the driver as Verified (Manual).</p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />

            {hasFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-md p-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>PDF on file (stored privately)</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={handlePreview}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" /> Replace
                  </Button>
                </div>
                {driver.background_check_status !== 'manual_clear' && (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Approve as Verified (Manual)
                  </Button>
                )}
                {driver.background_check_manual_approved_at && (
                  <p className="text-xs text-muted-foreground">
                    Approved: {new Date(driver.background_check_manual_approved_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? 'Uploading...' : 'Upload Background Check PDF'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}