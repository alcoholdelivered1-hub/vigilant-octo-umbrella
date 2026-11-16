import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Loader2, FileCheck2, ShieldCheck, Upload, Eye, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const AUDIT_DOCS = [
  { key: 'training_certificate_file_uri', label: 'Training Certificate', Icon: FileCheck2, hint: 'Upload your alcohol-delivery training completion certificate.' },
  { key: 'insurance_file_uri', label: 'Proof of Insurance', Icon: ShieldCheck, hint: 'Upload your current auto insurance document.' },
];

export default function DriverAuditDocuments({ userEmail }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState('');
  const [opening, setOpening] = useState('');
  const inputs = useRef({});

  const { data: driver, isLoading, isError } = useQuery({
    queryKey: ['driver-audit', userEmail],
    queryFn: async () => {
      const { items } = await base44.entities.Driver.filter({ email: userEmail }, { limit: 1 });
      return items[0] || null;
    },
    enabled: Boolean(userEmail),
  });

  const handleUpload = async (key, file) => {
    if (!driver?.id) { toast.error('Your driver record could not be found.'); return; }
    setUploading(key);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.Driver.update(driver.id, { [key]: file_uri });
      toast.success('Document saved to your driver record.');
      queryClient.invalidateQueries({ queryKey: ['driver-audit', userEmail] });
    } catch (e) {
      toast.error(e?.message || 'Upload failed.');
    } finally {
      setUploading('');
      if (inputs.current[key]) inputs.current[key].value = '';
    }
  };

  const handleView = async (key, label) => {
    const tab = window.open('', '_blank');
    if (!tab) { toast.error('Allow popups to view the document.'); return; }
    tab.opener = null;
    setOpening(key);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: driver[key] });
      tab.location.replace(signed_url);
    } catch (e) {
      tab.close();
      toast.error(e?.message || `Unable to open ${label}.`);
    } finally {
      setOpening('');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your documents…</div>;
  }
  if (isError || !driver) {
    return <div className="py-10 text-center text-muted-foreground">Your driver record could not be loaded.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5">
        <h2 className="font-display text-lg font-bold flex items-center gap-2"><FileCheck2 className="w-5 h-5 text-primary" /> Audit Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Upload your training certificate and proof of insurance. These are stored privately and linked to your driver record for compliance review.</p>
      </div>

      <div className="space-y-3">
        {AUDIT_DOCS.map(({ key, label, Icon, hint }) => {
          const uri = driver[key];
          const isUploading = uploading === key;
          const isOpening = opening === key;
          return (
            <div key={key} className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                {uri && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="w-4 h-4" /> On file</span>}
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={(el) => { inputs.current[key] = el; }}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(key, f); }}
                />
                <Button size="sm" variant={uri ? 'outline' : 'default'} disabled={isUploading} onClick={() => inputs.current[key]?.click()}>
                  {isUploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                  {uri ? 'Replace' : 'Upload'}
                </Button>
                {uri && (
                  <Button size="sm" variant="outline" disabled={isOpening} onClick={() => handleView(key, label)}>
                    {isOpening ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Eye className="w-4 h-4 mr-1.5" />}
                    View
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}