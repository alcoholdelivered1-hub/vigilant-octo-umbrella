import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Check, ClipboardList, Mail, ChevronDown, ChevronUp, Send, Loader2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import RetailerContractProfile from '@/components/onboarding/RetailerContractProfile';
import RetailerAgreementContext from '@/components/onboarding/RetailerAgreementContext';
import RetailerAgreementForm from '@/components/onboarding/RetailerAgreementForm';
import RetailerAgreementField from '@/components/onboarding/RetailerAgreementField';
import RetailerAgreementTerms from '@/components/onboarding/RetailerAgreementTerms';
import RetailerAgreementSignature from '@/components/onboarding/RetailerAgreementSignature';
import RetailerAgreementToolbar from '@/components/onboarding/RetailerAgreementToolbar';
import RetailerAgreementActions from '@/components/onboarding/RetailerAgreementActions';
import AgreementConfiguration from '@/components/onboarding/AgreementConfiguration';
import AgreementCountersignature from '@/components/onboarding/AgreementCountersignature';
import AgreementNotary from '@/components/onboarding/AgreementNotary';
import { useAuth } from '@/lib/AuthContext';
import PrepareRetailerAgreements from '@/components/onboarding/PrepareRetailerAgreements';

export default function RetailerContract() {
  const storeId = new URLSearchParams(window.location.search).get('store_id');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const queryClient = useQueryClient();

  const copyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers/iframes that block the clipboard API
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Retailer Partner Agreement – Alcohol Delivered', url });
        return;
      } catch (err) {
        // User cancelled or share is blocked (e.g. inside an iframe) — fall back to copy
        if (err?.name === 'AbortError') return;
      }
    }
    await copyLink(url);
  };

  const [showFollowUp, setShowFollowUp] = useState(false);

  const { data: pendingStores = [], isLoading } = useQuery({
    queryKey: ['contract-pending-stores'],
    enabled: isAdmin,
    queryFn: async () => {
      const stores = await base44.entities.Store.list();
      return stores.filter(s => ['pending', 'invited', 'contract_sent'].includes(s.onboarding_status));
    },
  });

  const invitedStores = pendingStores.filter(s => ['pending', 'invited'].includes(s.onboarding_status));
  const contractSentStores = pendingStores.filter(s => s.onboarding_status === 'contract_sent');

  const handleSendContracts = async () => {
    setSending(true);
    setSendResults(null);
    try {
      const res = await base44.functions.invoke('sendRetailerOnboardingEmail', {});
      if (res.data?.success) {
        toast.success(`Contract emails sent to ${res.data.sent} retailer${res.data.sent !== 1 ? 's' : ''}!`);
        setSendResults(res.data);
        queryClient.invalidateQueries({ queryKey: ['contract-pending-stores'] });
      } else {
        toast.error(res.data?.error || 'Failed to send emails');
      }
    } catch (e) {
      toast.error('Failed to send contract emails');
    }
    setSending(false);
  };

  return (
    <RetailerAgreementContext initialStoreId={storeId}>
    <div className="max-w-4xl mx-auto px-6 py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; font-size: 12pt; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Administrative follow-up tracker stays out of the retailer document. */}
      {isAdmin && <div className="no-print mb-6">
        <button
          onClick={() => setShowFollowUp(v => !v)}
          className="w-full flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-amber-800 text-sm">
              Retailer Contract Tracking
            </span>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold rounded-full px-2 py-0.5">
              {pendingStores.length} pending
            </span>
          </div>
          {showFollowUp ? <ChevronUp className="w-4 h-4 text-amber-600" /> : <ChevronDown className="w-4 h-4 text-amber-600" />}
        </button>

        {showFollowUp && (
          <div className="border border-amber-200 border-t-0 rounded-b-xl overflow-hidden">
            {/* Send button */}
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-amber-800">
                {invitedStores.length} not yet contacted · {contractSentStores.length} awaiting signature
                {invitedStores.filter(s => !s.email).length > 0 && (
                  <span className="flex items-center gap-1 text-red-600 mt-1">
                    <AlertCircle className="w-3 h-3" /> {invitedStores.filter(s => !s.email).length} stores missing email
                  </span>
                )}
              </div>
              <Button
                onClick={handleSendContracts}
                disabled={sending || invitedStores.filter(s => s.email).length === 0}
                className="gap-2"
                size="sm"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending...' : `Send to ${invitedStores.filter(s => s.email).length} Retailers`}
              </Button>
            </div>

            {sendResults && (
              <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-700">
                ✅ Sent: {sendResults.sent} · {sendResults.failed > 0 && `❌ Failed: ${sendResults.failed}`}
              </div>
            )}

            {isLoading ? (
              <p className="text-sm text-center text-muted-foreground py-4">Loading...</p>
            ) : pendingStores.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-4">All retailers have signed! 🎉</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b border-amber-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-amber-700">Store</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-amber-700">City</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-amber-700">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-amber-700">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-amber-700">Contract Sent</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-amber-700">Last Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 bg-white">
                  {pendingStores.map(store => (
                    <tr key={store.id} className="hover:bg-amber-50/50">
                      <td className="px-4 py-2.5 font-medium">{store.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{store.city}</td>
                      <td className="px-4 py-2.5">
                        {store.email ? (
                          <a href={`mailto:${store.email}`} className="flex items-center gap-1 text-primary hover:underline">
                            <Mail className="w-3 h-3" />{store.email}
                          </a>
                        ) : <span className="text-red-500 text-xs">No email</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {['pending', 'invited'].includes(store.onboarding_status) ? (
                          <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-medium">Not Contacted</span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 font-medium">Awaiting Signature</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {store.contract_sent_at
                          ? formatDistanceToNow(new Date(store.contract_sent_at), { addSuffix: true })
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {store.reminder_sent_at ? (
                          <span className="text-muted-foreground">{formatDistanceToNow(new Date(store.reminder_sent_at), { addSuffix: true })}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>}

      <div className="no-print flex flex-wrap gap-3 items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Retailer Partner Contract</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare} className="gap-2">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Link Copied!' : 'Share'}
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {isAdmin && <PrepareRetailerAgreements />}
      <RetailerAgreementToolbar />
      <RetailerAgreementForm key={storeId || 'unselected'}>

        {/* Header */}
        <div className="text-center border-b pb-6 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Third-Party Alcohol Delivery Agreement</p>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">RETAIL PARTNER AGREEMENT</h2>
          <p className="text-gray-600">Between <strong>Alcohol Delivered, LLC</strong> ("Delivery Platform") and the Retailer identified below</p>
        </div>

        <AgreementConfiguration />
        <RetailerAgreementField name="effective_date" type="date" required className="max-w-xs mx-auto" />
        <RetailerContractProfile />
        <RetailerAgreementTerms />

        {/* Signature Block */}
        <div className="border-t pt-6 space-y-6">
          <p className="font-semibold text-center">SIGNATURES</p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <AgreementCountersignature />
            <RetailerAgreementSignature />
          </div>
        </div>

        <AgreementNotary />

        <RetailerAgreementActions />
        <p className="text-center text-xs text-gray-400 pt-4 border-t">
          Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz · This document is confidential and intended for authorized parties only.
        </p>
      </RetailerAgreementForm>
    </div>
    </RetailerAgreementContext>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-1">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="border-b border-gray-400 h-6" />
    </div>
  );
}

function SignatureLine({ label }) {
  return (
    <div>
      <div className="border-b border-gray-400 h-8 mb-0.5" />
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}