import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink, Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function AgreementStep({ store, isAdmin }) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const signed = ['contract_signed', 'inventory_added', 'live'].includes(store?.onboarding_status);

  const sendContract = async () => {
    setSending(true);
    try {
      const res = await base44.functions.invoke('sendGoLiveChecklist', { store_id: store.id, onboarding_link: true });
      if (res.data?.success) {
        toast.success(`Agreement sent to ${store?.email || 'retailer'}.`);
        queryClient.invalidateQueries({ queryKey: ['onboarding-hub-stores'] });
      } else {
        toast.error(res.data?.error || 'Unable to send agreement.');
      }
    } catch (e) {
      toast.error(e?.message || 'Unable to send agreement.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">Status:</span>
        <span className="font-medium capitalize">{(store?.onboarding_status || 'invited').replace(/_/g, ' ')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/retailer-contract?store_id=${encodeURIComponent(store.id)}`}><ExternalLink className="w-3.5 h-3.5" /> {signed ? 'View agreement' : 'Review & sign'}</Link>
        </Button>
        {isAdmin && !signed && (
          <Button size="sm" onClick={sendContract} disabled={sending}>
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send agreement
          </Button>
        )}
      </div>
    </div>
  );
}