import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, Upload, Eye, Loader2, FileText, Plus, Trash2 } from 'lucide-react';
import { format, differenceInDays, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';

const PERMIT_TYPES = [
  { value: 'employer_background_check', label: 'Employer Background Check' },
  { value: 'arkansas_abc_third_party_delivery', label: 'AR ABC Third-Party Delivery Permit' },
  { value: 'city_business_license', label: 'City Business License' },
];

function daysUntil(dateStr) {
  if (!dateStr || !isValid(parseISO(dateStr))) return null;
  return differenceInDays(parseISO(dateStr), new Date());
}

export default function EmployerBackgroundCheckPanel({ store }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    permit_type: 'employer_background_check',
    permit_number: '',
    legal_name: store.name || '',
    issuing_authority: '',
    expiration_date: '',
  });
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: permits = [], isLoading } = useQuery({
    queryKey: ['store-permits', store.id],
    queryFn: () => base44.entities.BusinessPermit.filter({ store_id: store.id }, { sort: '-updated_date', limit: 100 }),
  });

  const createPermitMutation = useMutation({
    mutationFn: async ({ file, formData }) => {
      setUploading(true);
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await base44.entities.BusinessPermit.create({
        store_id: store.id,
        store_email: store.email || '',
        permit_type: formData.permit_type,
        permit_number: formData.permit_number,
        legal_name: formData.legal_name,
        issuing_authority: formData.issuing_authority,
        expiration_date: formData.expiration_date,
        status: 'active',
        document_on_file: true,
        document_filename: file.name,
        document_file_uri: file_uri,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-permits', store.id] });
      queryClient.invalidateQueries({ queryKey: ['compliance-permits'] });
      toast.success('Document uploaded (stored privately)');
      setUploading(false);
      setShowForm(false);
      setForm({ ...form, permit_number: '', issuing_authority: '', expiration_date: '' });
    },
    onError: (err) => {
      toast.error(err.message || 'Upload failed');
      setUploading(false);
    },
  });

  const deletePermitMutation = useMutation({
    mutationFn: (permitId) => base44.entities.BusinessPermit.delete(permitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-permits', store.id] });
      queryClient.invalidateQueries({ queryKey: ['compliance-permits'] });
      toast.success('Document removed');
    },
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    if (!form.permit_number || !form.legal_name || !form.issuing_authority || !form.expiration_date) {
      toast.error('Please fill in all fields before uploading');
      return;
    }
    createPermitMutation.mutate({ file, formData: form });
  };

  const handlePreview = async (permit) => {
    if (!permit.document_file_uri) return;
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: permit.document_file_uri });
      window.open(signed_url, '_blank');
    } catch (err) {
      toast.error('Could not generate preview link');
    }
  };

  const permitCount = permits.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
          <ShieldCheck className="w-3 h-3" />
          Compliance ({permitCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Employer Compliance — {store.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-xs text-muted-foreground">
            Upload employer background checks, business licenses, and ABC permits. Expiration dates and statuses sync to the Compliance Dashboard automatically.
          </p>

          {/* Existing documents */}
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : permits.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No compliance documents on file yet.
            </div>
          ) : (
            <div className="space-y-2">
              {permits.map((p) => {
                const days = daysUntil(p.expiration_date);
                const isExpired = days !== null && days < 0;
                const isExpiring = days !== null && days >= 0 && days <= 30;
                return (
                  <div key={p.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                          {PERMIT_TYPES.find(t => t.value === p.permit_type)?.label || p.permit_type.replace(/_/g, ' ')}
                        </span>
                        {isExpired && <span className="text-xs font-bold text-red-600">EXPIRED</span>}
                        {isExpiring && <span className="text-xs font-bold text-amber-600">EXPIRES IN {days}d</span>}
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">{p.permit_number} · {p.legal_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {p.expiration_date ? format(parseISO(p.expiration_date), 'MMM d, yyyy') : '—'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {p.document_file_uri && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePreview(p)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deletePermitMutation.mutate(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload form */}
          {showForm ? (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Compliance Document</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Document Type</Label>
                  <Select value={form.permit_type} onValueChange={(v) => setForm({ ...form, permit_type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERMIT_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Permit / License Number *</Label>
                  <Input className="h-8 text-xs" value={form.permit_number} onChange={(e) => setForm({ ...form, permit_number: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Legal Name on Document *</Label>
                  <Input className="h-8 text-xs" value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Issuing Authority *</Label>
                  <Input className="h-8 text-xs" placeholder="e.g. Arkansas ABC, City of Pine Bluff" value={form.issuing_authority} onChange={(e) => setForm({ ...form, issuing_authority: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiration Date *</Label>
                  <Input type="date" className="h-8 text-xs" value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={uploading || !form.permit_number || !form.legal_name || !form.issuing_authority || !form.expiration_date} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
                  {uploading ? 'Uploading...' : 'Upload PDF'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="w-full" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Compliance Document
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}