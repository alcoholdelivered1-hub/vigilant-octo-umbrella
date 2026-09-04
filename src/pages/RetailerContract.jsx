import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Check, ClipboardList, Mail, ChevronDown, ChevronUp, Send, Loader2, AlertCircle, PenLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function RetailerContract() {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState(null);
  const [signing, setSigning] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['my-store-contract', user?.email, user?.username],
    queryFn: async () => {
      if (!user) return [];
      try {
        // 0) If the email link included ?store=<id>, fetch that store directly
        const params = new URLSearchParams(window.location.search);
        const storeIdFromUrl = params.get('store');
        if (storeIdFromUrl) {
          try {
            const store = await base44.entities.Store.get(storeIdFromUrl);
            if (store) return [store];
          } catch (e) {
            console.error('RetailerContract: could not fetch store by URL id', e);
          }
        }

        // 1) Try exact email filter first
        if (user.email) {
          const byEmail = await base44.entities.Store.filter({ email: user.email });
          if (byEmail && byEmail.length) return byEmail;
        }

        // 2) Fallback: fetch list and match case-insensitively against email or username
        const allStores = await base44.entities.Store.list('-created_date', 200);
        const lowerEmail = user.email?.toLowerCase();
        const lowerUsername = user.username?.toLowerCase();
        const matched = allStores.filter(s => {
          const se = s.email || '';
          const sn = s.name || '';
          return (se && (se.toLowerCase() === lowerEmail || se.toLowerCase() === lowerUsername)) || (lowerUsername && sn.toLowerCase().includes(lowerUsername));
        });
        if (matched && matched.length) return matched;

        // 3) No match
        return [];
      } catch (e) {
        console.error('RetailerContract: error finding stores', e);
        return [];
      }
    },
    enabled: !!user,
  });
  const myStore = stores[0];

  const handleSignContract = async () => {
    setSigning(true);
    try {
      // Determine which store to sign for: matched store, or license number lookup
      let storeId = myStore?.id;

      // If no matched store, try license number lookup (the URL ?store= param was
      // already attempted in the store query above — if it didn't match, it's invalid)
      if (!storeId && form.licenseNumber) {
        const byLicense = await base44.entities.Store.filter({ license_number: form.licenseNumber });
        storeId = byLicense?.[0]?.id || null;
      }

      if (!storeId) {
        toast.error('Could not find your store. Please ensure your ABC license number is entered correctly, or contact the admin.');
        setSigning(false);
        return;
      }

      const res = await base44.functions.invoke('signRetailerContract', {
        store_id: storeId,
        formData: form,
      });

      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['my-store-contract'] });
        queryClient.invalidateQueries({ queryKey: ['my-store-onboarding'] });
        toast.success('Contract signed! Redirecting to your onboarding dashboard...');
        setTimeout(() => navigate('/retailer-onboarding'), 1500);
      } else {
        toast.error(res.data?.error || 'Failed to sign contract.');
      }
    } catch (e) {
      toast.error('Failed to sign contract. Please try again.');
    }
    setSigning(false);
  };

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
  const [form, setForm] = useState({
    storeName: '',
    licenseNumber: '',
    address: '',
    city: '',
    state: 'AR',
    county: '',
    zipCode: '',
    ownerName: '',
    ownerTitle: '',
    phone: '',
    email: '',
    posSystem: '',
    merchantId: '',
    apiKey: '',
  });

  useEffect(() => {
    if (!myStore) return;
    setForm({
      storeName: myStore.name || '',
      licenseNumber: myStore.license_number || '',
      address: myStore.address || '',
      city: myStore.city || '',
      state: myStore.state || 'AR',
      county: myStore.county || '',
      zipCode: myStore.zip_code || '',
      ownerName: user?.full_name || '',
      ownerTitle: '',
      phone: myStore.phone || '',
      email: myStore.email || user?.email || '',
      posSystem: '',
      merchantId: '',
      apiKey: '',
    });
  }, [myStore, user]);

  const updateFormField = (name, value) => setForm(prev => ({ ...prev, [name]: value }));

  const { data: pendingStores = [], isLoading } = useQuery({
    queryKey: ['contract-pending-stores'],
    queryFn: async () => {
      const stores = await base44.entities.Store.list();
      return stores.filter(s => s.onboarding_status === 'invited' || s.onboarding_status === 'contract_sent');
    },
  });

  const invitedStores = pendingStores.filter(s => s.onboarding_status === 'invited');
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
    <div className="max-w-4xl mx-auto px-6 py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; font-size: 12pt; }
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      {/* Follow-up tracker */}
      <div className="no-print mb-6">
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
                        {store.onboarding_status === 'invited' ? (
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
      </div>

      <div className="no-print flex items-center justify-between mb-6">
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

      <div className="print-page bg-white border rounded-2xl shadow-sm p-10 space-y-8 text-sm leading-relaxed text-gray-800">

        {/* Header */}
        <div className="text-center border-b pb-6 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Third-Party Alcohol Delivery Agreement</p>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">RETAIL PARTNER AGREEMENT</h2>
          <p className="text-gray-600">Between <strong>Alcohol Delivered, LLC</strong> ("Delivery Platform") and the Retailer identified below</p>
        </div>

        {/* Effective Date */}
        <div className="text-center text-sm text-gray-600">
          This Agreement is entered into as of: <span className="inline-block border-b border-gray-400 w-40 mx-2 align-bottom" />
        </div>

        {/* Retailer Info Fields */}
        <div className="grid grid-cols-2 gap-6 border rounded-xl p-5 bg-gray-50">
          <div className="space-y-3">
            <EditableField
              label="Retailer / Store Name"
              value={form.storeName}
              onChange={(value) => updateFormField('storeName', value)}
            />
            <EditableField
              label="ABC License Number"
              value={form.licenseNumber}
              onChange={(value) => updateFormField('licenseNumber', value)}
            />
            <EditableField
              label="Store Address"
              value={form.address}
              onChange={(value) => updateFormField('address', value)}
            />
            <EditableField
              label="County"
              value={form.county}
              onChange={(value) => updateFormField('county', value)}
            />
            <div className="grid grid-cols-3 gap-3">
              <EditableField
                label="City"
                value={form.city}
                onChange={(value) => updateFormField('city', value)}
              />
              <EditableField
                label="State"
                value={form.state}
                onChange={(value) => updateFormField('state', value)}
              />
              <EditableField
                label="ZIP"
                value={form.zipCode}
                onChange={(value) => updateFormField('zipCode', value)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <EditableField
              label="Owner / Authorized Representative"
              value={form.ownerName}
              onChange={(value) => updateFormField('ownerName', value)}
            />
            <EditableField
              label="Title / Position"
              value={form.ownerTitle}
              onChange={(value) => updateFormField('ownerTitle', value)}
            />
            <EditableField
              label="Phone Number"
              value={form.phone}
              onChange={(value) => updateFormField('phone', value)}
            />
            <EditableField
              label="Email Address"
              value={form.email}
              onChange={(value) => updateFormField('email', value)}
            />
            <PosSystemField
              value={form.posSystem}
              onChange={(value) => updateFormField('posSystem', value)}
            />
            {form.posSystem && form.posSystem !== 'none' && (
              <div className="grid grid-cols-2 gap-3">
                <EditableField
                  label="Merchant ID"
                  value={form.merchantId}
                  onChange={(value) => updateFormField('merchantId', value)}
                />
                <EditableField
                  label="API Key / Token"
                  value={form.apiKey}
                  onChange={(value) => updateFormField('apiKey', value)}
                />
              </div>
            )}
          </div>
        </div>

        <Section title="1. PURPOSE">
          <p>
            This Agreement establishes the terms under which Alcohol Delivered, LLC ("Platform") will facilitate
            the delivery of alcoholic beverages on behalf of the Retailer to customers located within lawful
            wet jurisdictions in Arkansas. The Retailer remains the seller of record at all times. The Platform
            acts solely as a third-party delivery service and does not hold title to or sell any alcohol.
          </p>
        </Section>

        <Section title="2. ARKANSAS ABC COMPLIANCE">
          <ul className="list-disc list-inside space-y-1">
            <li>The Retailer holds a valid Arkansas Alcoholic Beverage Control (ABC) retail license and agrees to maintain it in good standing.</li>
            <li>The Platform holds a valid Arkansas Third-Party Delivery Permit and agrees to maintain it in good standing.</li>
            <li>All deliveries shall occur only during legally permitted alcohol sale hours and only to lawful wet areas.</li>
            <li>Deliveries shall be made only within the same county or an adjacent wet county as the Retailer's licensed premises.</li>
            <li>No alcohol shall be delivered to any person under the age of 21, or to any person who appears intoxicated.</li>
          </ul>
        </Section>

        <Section title="3. ROLES AND RESPONSIBILITIES">
          <p className="font-semibold mb-1">Retailer Responsibilities:</p>
          <ul className="list-disc list-inside space-y-1 mb-3">
            <li>Receive and confirm customer orders placed through the Platform.</li>
            <li>Prepare and package orders in sealed, tamper-evident packaging.</li>
            <li>Ensure all items are accurately picked, labeled, and ready for driver pickup within agreed timeframes.</li>
            <li>Maintain accurate product inventory and pricing in the Platform system.</li>
            <li>Immediately notify the Platform of any product unavailability or fulfillment issues.</li>
          </ul>
          <p className="font-semibold mb-1">Platform Responsibilities:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Operate and maintain a technology platform for order placement, routing, and customer communication.</li>
            <li>Recruit, train, and manage delivery drivers in compliance with Arkansas ABC regulations.</li>
            <li>Verify customer age (21+) at time of order placement via digital ID upload.</li>
            <li>Ensure drivers verify customer ID again at the point of delivery.</li>
            <li>Maintain delivery logs and ID verification records for ABC inspection upon request.</li>
            <li>Carry commercial auto and general liability insurance for all delivery operations.</li>
          </ul>
        </Section>

        <Section title="4. ORDER PROCESS">
          <ol className="list-decimal list-inside space-y-1">
            <li>Customer places order through the Platform's app/website.</li>
            <li>Customer's age is verified digitally at checkout (21+ required).</li>
            <li>Order is transmitted to the Retailer for preparation.</li>
            <li>Platform assigns a trained, compliant driver to pick up the order.</li>
            <li>Driver presents Platform ID badge and picks up the sealed order.</li>
            <li>Driver delivers to customer, verifies government-issued ID at door, and refuses delivery if customer is underage or intoxicated.</li>
            <li>Delivery confirmation and ID verification record are logged in the Platform system.</li>
          </ol>
        </Section>

        <Section title="5. FEES AND PAYMENT">
          <ul className="list-disc list-inside space-y-1">
            <li>The Platform collects a <strong>service fee of 25%</strong> of the order subtotal from the customer.</li>
            <li>The Platform collects a <strong>delivery fee</strong> (as set per delivery zone) from the customer.</li>
            <li>The Retailer receives <strong>100% of the product subtotal</strong>, minus any agreed Platform listing or integration fees.</li>
            <li>Payment to the Retailer shall be remitted within <span className="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> business days of order completion.</li>
            <li>The Retailer is responsible for all applicable alcohol excise taxes and state sales taxes on products sold.</li>
            <li>The Platform is responsible for its own business income taxes on service and delivery fees collected.</li>
          </ul>
        </Section>

        <Section title="6. PLACEMENT TIERS (OPTIONAL)">
          <p className="mb-2">Retailers may elect to upgrade their listing visibility within the Platform at the following rates:</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2 font-semibold">Tier</th>
                  <th className="text-left p-2 font-semibold">Monthly Fee</th>
                  <th className="text-left p-2 font-semibold">Benefits</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr><td className="p-2">Standard</td><td className="p-2">Free</td><td className="p-2">Basic listing in store directory</td></tr>
                <tr><td className="p-2">Featured</td><td className="p-2">$50/mo</td><td className="p-2">Highlighted listing, priority placement in search results</td></tr>
                <tr><td className="p-2">Premium</td><td className="p-2">$150/mo</td><td className="p-2">Top placement, featured on homepage, promotional banners</td></tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="7. PROHIBITED CONDUCT">
          <p>Neither party shall:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Sell or deliver alcohol to any person under 21 years of age.</li>
            <li>Deliver to an intoxicated person.</li>
            <li>Deliver to a dry county or outside legally permitted hours.</li>
            <li>Allow the Platform to hold title to or take possession of alcohol inventory.</li>
            <li>Misrepresent pricing, availability, or licensing status.</li>
          </ul>
        </Section>

        <Section title="8. INSURANCE">
          <p>
            Each party shall maintain, at its own expense, appropriate insurance coverage including general
            liability insurance of no less than $1,000,000 per occurrence. The Platform shall maintain
            commercial auto insurance covering all delivery vehicles operated under this Agreement.
            The Retailer is strongly encouraged to carry liquor liability insurance.
          </p>
        </Section>

        <Section title="9. TERM AND TERMINATION">
          <ul className="list-disc list-inside space-y-1">
            <li>This Agreement begins on the date of signing and continues for <span className="underline">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> months, renewing automatically unless terminated.</li>
            <li>Either party may terminate this Agreement with <strong>30 days' written notice</strong>.</li>
            <li>Either party may terminate immediately for cause, including ABC license revocation, fraud, or material breach.</li>
          </ul>
        </Section>

        <Section title="10. LIABILITY AND INDEMNIFICATION">
          <p>
            Each party agrees to indemnify and hold harmless the other from any claims, damages, or penalties
            arising from its own acts or omissions. The Platform assumes full responsibility for driver conduct
            during delivery. The Retailer assumes full responsibility for product quality and accurate fulfillment.
            Neither party shall be liable for consequential or indirect damages.
          </p>
        </Section>

        <Section title="11. GOVERNING LAW">
          <p>
            This Agreement shall be governed by the laws of the State of Arkansas. Any disputes shall be
            resolved in Jefferson County, Arkansas. This Agreement constitutes the entire understanding
            between the parties and supersedes all prior discussions.
          </p>
        </Section>

        {/* Signature Block */}
        <div className="border-t pt-6 space-y-6">
          <p className="font-semibold text-center">SIGNATURES</p>
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-4">
              <p className="font-semibold text-xs uppercase tracking-wide text-gray-500">Alcohol Delivered, LLC</p>
              <SignatureLine label="Authorized Signature" />
              <SignatureLine label="Printed Name" />
              <SignatureLine label="Title" />
              <SignatureLine label="Date" />
            </div>
            <div className="space-y-4">
              <p className="font-semibold text-xs uppercase tracking-wide text-gray-500">Retailer / Liquor Store</p>
              <SignatureLine label="Authorized Signature" />
              <SignatureLine label="Printed Name" />
              <SignatureLine label="Title" />
              <SignatureLine label="Date" />
            </div>
          </div>
        </div>

        {/* Notary Block */}
        <div className="border rounded-xl p-5 bg-gray-50 space-y-3">
          <p className="font-semibold text-xs uppercase tracking-wide text-gray-500 text-center">Notary Acknowledgment (Optional)</p>
          <p className="text-xs text-gray-600">State of Arkansas, County of <span className="inline-block border-b border-gray-400 w-32 mx-1 align-bottom" /></p>
          <p className="text-xs text-gray-600">Subscribed and sworn before me this <span className="inline-block border-b border-gray-400 w-12 mx-1 align-bottom" /> day of <span className="inline-block border-b border-gray-400 w-24 mx-1 align-bottom" />, 20<span className="inline-block border-b border-gray-400 w-8 mx-1 align-bottom" /></p>
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div>
              <div className="border-b border-gray-400 h-8 mb-0.5" />
              <p className="text-xs text-gray-500">Notary Public Signature</p>
            </div>
            <div>
              <div className="border-b border-gray-400 h-8 mb-0.5" />
              <p className="text-xs text-gray-500">Commission Expires</p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 pt-4 border-t">
          Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz · This document is confidential and intended for authorized parties only.
        </p>
      </div>

      {/* Sign Contract Button */}
      {!myStore && (
        <div className="no-print mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          <strong>Tip:</strong> Enter your store's ABC license number above, then click Sign Contract — we'll match it to your store record.
        </div>
      )}
      <div className="no-print mt-6 flex flex-col items-center gap-3">
        {myStore && (myStore.onboarding_status === 'contract_signed' ||
         myStore.onboarding_status === 'inventory_added' ||
         myStore.onboarding_status === 'live') ? (
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <Check className="w-5 h-5" />
            Contract Signed
          </div>
        ) : (
          <Button
            size="lg"
            onClick={handleSignContract}
            disabled={signing}
            className="gap-2"
          >
            {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PenLine className="w-5 h-5" />}
            {signing ? 'Signing...' : 'Sign Contract'}
          </Button>
        )}
        <p className="text-xs text-muted-foreground text-center max-w-md">
          By clicking "Sign Contract," you acknowledge that you have read and agree to the terms of this Retail Partner Agreement.
        </p>
      </div>
    </div>
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

function EditableField({ label, value, onChange }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
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

function PosSystemField({ value, onChange }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block" htmlFor="pos-system">
        POS System Used
      </label>
      <select
        id="pos-system"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <option value="">Select your POS system…</option>
        <option value="clover">Clover</option>
        <option value="square">Square</option>
        <option value="toast">Toast</option>
        <option value="ncr">NCR / Aloha</option>
        <option value="lightspeed">Lightspeed</option>
        <option value="shopkeep">ShopKeep</option>
        <option value="other">Other</option>
        <option value="none">None / Manual</option>
      </select>
    </div>
  );
}