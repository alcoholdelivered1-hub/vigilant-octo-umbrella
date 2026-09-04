import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShieldCheck, AlertTriangle, FileText, CheckCircle2, XCircle, ClipboardList, Activity, Mail, Copy, ShieldAlert } from 'lucide-react';
import StatCard from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import ExpiringDocuments from '@/components/compliance/ExpiringDocuments';
import BorderlineDeliveries from '@/components/compliance/BorderlineDeliveries';
import WeeklyTrainingSummary from '@/components/compliance/WeeklyTrainingSummary';
import ComplianceFlags from '@/components/compliance/ComplianceFlags';
import StoreLicenseAudit from '@/components/compliance/StoreLicenseAudit';
import FailedDeliveriesTab from '@/components/compliance/FailedDeliveriesTab';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function StoreEmailsTab({ stores }) {
  const storesWithEmail = stores.filter(s => s.email);
  const storesWithout = stores.filter(s => !s.email);
  const allEmails = storesWithEmail.map(s => s.email).join(', ');

  const copyAll = () => {
    navigator.clipboard.writeText(allEmails).catch(() => {});
    toast.success(`Copied ${storesWithEmail.length} email addresses`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-blue-800 flex items-center gap-2"><Mail className="w-4 h-4" /> Retailer Contact Emails</p>
          <p className="text-xs text-blue-600 mt-0.5">{storesWithEmail.length} stores with email · {storesWithout.length} missing</p>
        </div>
        <Button size="sm" variant="outline" onClick={copyAll} disabled={!storesWithEmail.length} className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-100">
          <Copy className="w-3.5 h-3.5" /> Copy All
        </Button>
      </div>

      {storesWithEmail.length > 0 && (
        <div className="bg-card border rounded-2xl divide-y">
          {storesWithEmail.map(store => (
            <div key={store.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{store.name}</p>
                <p className="text-xs text-muted-foreground">{store.city}, {store.county} Co. · License: {store.license_number}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`mailto:${store.email}`} className="text-sm text-primary hover:underline">{store.email}</a>
                <button onClick={() => { navigator.clipboard.writeText(store.email).catch(() => {}); toast.success('Copied'); }} className="text-muted-foreground hover:text-foreground">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {storesWithout.length > 0 && (
        <div className="bg-card border border-amber-200 rounded-2xl">
          <div className="px-5 py-3 border-b border-amber-200 bg-amber-50 rounded-t-2xl">
            <p className="text-sm font-semibold text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Missing Email ({storesWithout.length})</p>
          </div>
          <div className="divide-y">
            {storesWithout.map(store => (
              <div key={store.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{store.name}</p>
                  <p className="text-xs text-muted-foreground">{store.city} · License: {store.license_number}</p>
                </div>
                <span className="text-xs text-amber-600 font-medium">No email on file</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CHECKLIST = [
  { id: 'A', title: 'Third-Party Delivery Permit', items: ['Apply with Arkansas Alcoholic Beverage Control (ABC)', 'Pay required annual fee (~$500)', 'Must be approved before operating'] },
  { id: 'B', title: 'Business Registration', items: ['Register LLC or Corporation in Arkansas', 'Be in good standing with Secretary of State'] },
  { id: 'C', title: 'Eligibility', items: ['Can be individual, LLC, or corporation', 'Cannot be a manufacturer or wholesaler'] },
  { id: 'D', title: 'Retailer Partnerships', items: ['Must contract with licensed retailers (liquor stores, grocery stores, etc.)', 'You do NOT sell alcohol — retailer remains seller'] },
  { id: 'E', title: 'Driver Requirements', items: ['Must be 21+', 'Valid driver\'s license', 'No felony convictions'] },
  { id: 'F', title: 'Driver Model', items: ['Employees allowed', 'Independent contractors allowed'] },
  { id: 'G', title: 'Training Program', items: ['Create alcohol safety training', 'Must include ID checks, intoxication rules, fake ID detection', 'Submit to ABC for approval'] },
  { id: 'H', title: 'Age Verification', items: ['Check valid government-issued ID at delivery', 'Customer must be 21+', 'Refuse delivery if underage or intoxicated'] },
  { id: 'I', title: 'Delivery Rules', items: ['Deliver only from licensed retailer to customer', 'Must be a legitimate order'] },
  { id: 'J', title: 'Delivery Area', items: ['Same county or adjacent wet county only'] },
  { id: 'K', title: 'Wet/Dry Compliance', items: ['Deliver only in legal (wet) areas'] },
  { id: 'L', title: 'Delivery Hours', items: ['Only during legal alcohol sale hours', 'Delivery must occur promptly after pickup'] },
  { id: 'M', title: 'Order Requirements', items: ['Must be placed by person 21+', 'Delivered to buyer or another person age 21+'] },
  { id: 'N', title: 'Liability', items: ['You are responsible for delivery compliance', 'Retailer is not liable for your violations'] },
  { id: 'O', title: 'Contracts', items: ['Written agreements with retailers required', 'Must define roles, liability, and payment structure'] },
  { id: 'P', title: 'Payments', items: ['Platform or retailer can process payment', 'Retailer remains legal seller'] },
  { id: 'Q', title: 'Insurance', items: ['General liability insurance', 'Commercial auto insurance', 'Liquor liability insurance (strongly recommended)'] },
  { id: 'R', title: 'Recordkeeping', items: ['Maintain delivery logs', 'Keep ID verification records', 'Track order timestamps'] },
  { id: 'S', title: 'Technology', items: ['App/system for order tracking', 'ID verification process', 'Retailer integration'] },
  { id: 'T', title: 'Inventory Rule', items: ['Cannot own or resell alcohol', 'Only deliver retailer\'s product'] },
  { id: 'U', title: 'Packaging', items: ['Must be sealed by retailer', 'No open containers'] },
  { id: 'V', title: 'Vehicles', items: ['Registered and insured', 'No open alcohol in driver area'] },
  { id: 'W', title: 'Local Requirements (Pine Bluff)', items: ['City business license', 'Zoning compliance if operating facility'] },
  { id: 'X', title: 'Taxes', items: ['Retailer pays alcohol taxes', 'You pay business/income taxes on fees'] },
  { id: 'Y', title: 'Penalties', items: ['Fines, suspension, or revocation by ABC for violations'] },
  { id: 'Z', title: 'Final Approval', items: ['ABC permit approved', 'Training program approved', 'Retail contracts signed before launch'] },
];

export default function Compliance() {
  const [tab, setTab] = useState('flags');
  const [checked, setChecked] = useState({});
  const [sendingReport, setSendingReport] = useState(false);
  const [sendingChecklist, setSendingChecklist] = useState(false);

  const handleSendChecklist = async () => {
    setSendingChecklist(true);
    try {
      const res = await base44.functions.invoke('sendComplianceChecklist', {});
      if (res.data?.success) {
        toast.success(`Checklist sent to ${res.data.sent_to}`);
      } else {
        toast.error('Failed to send checklist');
      }
    } catch {
      toast.error('Failed to send checklist');
    } finally {
      setSendingChecklist(false);
    }
  };

  const handleSendReport = async () => {
    setSendingReport(true);
    try {
      const res = await base44.functions.invoke('generateWeeklyComplianceReport', {});
      if (res.data?.success) {
        toast.success(`Weekly report sent to ${res.data.report_sent_to}`, {
          description: `${res.data.flagged_orders} flags · ${res.data.total_orders} orders reviewed`,
        });
      } else {
        toast.error('Failed to send report');
      }
    } catch {
      toast.error('Failed to send report');
    } finally {
      setSendingReport(false);
    }
  };

  const toggleItem = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const totalItems = CHECKLIST.reduce((acc, s) => acc + s.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  const { data: verifications = [], isLoading: vLoading } = useQuery({
    queryKey: ['compliance-verifications'],
    queryFn: () => base44.entities.IDVerification.list('-created_date', 100),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['compliance-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['compliance-drivers'],
    queryFn: () => base44.entities.Driver.list(),
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['compliance-stores'],
    queryFn: () => base44.entities.Store.list(),
  });

  const checkoutVerifications = verifications.filter(v => v.verification_type === 'checkout');
  const deliveryVerifications = verifications.filter(v => v.verification_type === 'delivery');
  const refusedOrders = orders.filter(o => o.status === 'refused');
  const trainedDrivers = drivers.filter(d => d.training_completed);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 print:px-0 print:py-0">
      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          body { background: white; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
      <div className="mb-6 flex items-start justify-between">
        <div>
        <h1 className="font-display text-3xl font-bold">Compliance & Audit</h1>
          <p className="text-muted-foreground mt-1 print:hidden">Arkansas ABC compliance monitoring and records</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={handleSendChecklist} disabled={sendingChecklist} className="gap-2">
            {sendingChecklist ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {sendingChecklist ? 'Sending…' : 'Send Checklist to ABC'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendReport} disabled={sendingReport} className="gap-2">
            {sendingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {sendingReport ? 'Sending…' : 'Send Weekly Report'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit mb-8 no-print print:hidden flex-wrap">
        <button onClick={() => setTab('flags')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'flags' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Live Flags
        </button>
        <button onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'audit' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Audit Records
        </button>
        <button onClick={() => setTab('checklist')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'checklist' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <ClipboardList className="w-4 h-4" />
          ABC Checklist
          {checkedCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 font-bold">{checkedCount}/{totalItems}</span>
          )}
        </button>
        <button onClick={() => setTab('monitor')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'monitor' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Activity className="w-4 h-4" />
          Driver Monitoring
        </button>
        <button onClick={() => setTab('stores')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'stores' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <FileText className="w-4 h-4 text-red-500" />
          Store Licenses
        </button>
        <button onClick={() => setTab('store-emails')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'store-emails' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Mail className="w-4 h-4 text-blue-500" />
          Store Emails
        </button>
        <button onClick={() => setTab('failed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${tab === 'failed' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <ShieldAlert className="w-4 h-4 text-red-500" />
          Failed Deliveries
        </button>
      </div>

      {/* Live Flags Tab */}
      {tab === 'flags' && (
        <div className="space-y-6">
          <ComplianceFlags orders={orders} drivers={drivers} verifications={verifications} />
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> About This Monitor</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside mt-1">
              <li>Flags orders missing checkout or delivery ID verification</li>
              <li>Flags orders delivered outside legal wet zones (is_in_legal_zone = false)</li>
              <li>Flags deliveries made by drivers who have not completed ACT 157 training</li>
              <li>A <strong>weekly email summary</strong> is automatically sent every Friday at 8am to your compliance officer</li>
              <li>Use "Send Weekly Report" above to send a report on demand at any time</li>
            </ul>
          </div>
        </div>
      )}

      {/* ABC Checklist Tab */}
      {tab === 'checklist' && (
        <>
        <div className="hidden print:block mb-4">
          <p className="text-sm text-gray-500">Printed: {new Date().toLocaleDateString()} · Pine Bluff, AR</p>
        </div>
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-primary">Arkansas Third-Party Alcohol Delivery Checklist</p>
              <p className="text-sm text-muted-foreground mt-0.5">Pine Bluff / Jefferson County – Updated for 2025 Law</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{checkedCount}<span className="text-base font-normal text-muted-foreground">/{totalItems}</span></p>
              <div className="w-32 h-2 bg-muted rounded-full mt-1">
                <div className="h-2 bg-primary rounded-full transition-all" style={{ width: `${(checkedCount / totalItems) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {CHECKLIST.map(section => (
              <div key={section.id} className="bg-card rounded-2xl border p-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{section.id}</span>
                  <h3 className="font-semibold text-sm">{section.title}</h3>
                </div>
                {section.items.map((item, i) => {
                  const key = `${section.id}-${i}`;
                  return (
                    <div key={key} onClick={() => toggleItem(key)}
                      className="flex items-start gap-3 cursor-pointer group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${checked[key] ? 'bg-emerald-500 border-emerald-500' : 'border-border group-hover:border-primary/50'}`}>
                        {checked[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <p className={`text-sm leading-relaxed transition-colors ${checked[key] ? 'line-through text-muted-foreground' : ''}`}>{item}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        </>
      )}

      {tab === 'monitor' && (
        <div className="space-y-6">
          <WeeklyTrainingSummary drivers={drivers} />
          <ExpiringDocuments drivers={drivers} />
          <BorderlineDeliveries orders={orders} />
        </div>
      )}

      {tab === 'stores' && (
        <StoreLicenseAudit />
      )}

      {tab === 'store-emails' && (
        <StoreEmailsTab stores={stores} />
      )}

      {tab === 'failed' && <FailedDeliveriesTab />}

      {tab === 'audit' && <>
        <div className="hidden print:block mb-4">
          <p className="text-sm text-gray-500">Compliance Report — Printed: {new Date().toLocaleDateString()}</p>
        </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Checkout Verifications" value={checkoutVerifications.length} icon={ShieldCheck} />
        <StatCard title="Delivery Verifications" value={deliveryVerifications.length} icon={CheckCircle2} />
        <StatCard title="Refused Deliveries" value={refusedOrders.length} icon={AlertTriangle} />
        <StatCard title="Trained Drivers" value={`${trainedDrivers.length}/${drivers.length}`} icon={FileText} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ID Verification Log */}
        <div className="bg-card rounded-2xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">ID Verification Log</h2>
            <p className="text-xs text-muted-foreground">Records maintained for state inspection</p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {vLoading ? (
              <p className="p-6 text-center text-muted-foreground">Loading...</p>
            ) : verifications.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">No verifications yet</p>
            ) : (
              verifications.map(v => (
                <div key={v.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{v.customer_name || v.customer_email}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {v.verification_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.id_type?.replace(/_/g, ' ')} · DOB: {v.date_of_birth}
                    </p>
                  </div>
                  <div className="text-right">
                    {v.is_verified ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.created_date ? format(new Date(v.created_date), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Refused Deliveries */}
        <div className="bg-card rounded-2xl border">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Refused / Cancelled Deliveries</h2>
            <p className="text-xs text-muted-foreground">Audit trail for refused orders</p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {refusedOrders.length === 0 ? (
              <p className="p-6 text-center text-muted-foreground">No refused deliveries</p>
            ) : (
              refusedOrders.map(order => (
                <div key={order.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{order.order_number}</span>
                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200 text-xs">Refused</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customer: {order.customer_name} · Driver: {order.driver_name || 'N/A'}
                  </p>
                  {order.refusal_reason && (
                    <p className="text-xs mt-1 bg-red-50 rounded-lg p-2 text-red-700">{order.refusal_reason}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Driver Training Status */}
        <div className="bg-card rounded-2xl border lg:col-span-2">
          <div className="p-5 border-b">
            <h2 className="font-semibold">Driver Training & Compliance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Driver</th>
                  <th className="text-left p-3 font-medium">Age 21+</th>
                  <th className="text-left p-3 font-medium">Training</th>
                  <th className="text-left p-3 font-medium">Training Date</th>
                  <th className="text-left p-3 font-medium">Total Deliveries</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {drivers.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No drivers</td></tr>
                ) : (
                  drivers.map(d => {
                    let isOver21 = false;
                    if (d.date_of_birth) {
                      const birth = new Date(d.date_of_birth);
                      const now = new Date();
                      let age = now.getFullYear() - birth.getFullYear();
                      const m = now.getMonth() - birth.getMonth();
                      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
                      isOver21 = age >= 21;
                    }
                    return (
                      <tr key={d.id}>
                        <td className="p-3 font-medium">{d.name}</td>
                        <td className="p-3">
                          {d.date_of_birth ? (
                            isOver21 ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />
                          ) : <span className="text-xs text-muted-foreground">Not set</span>}
                        </td>
                        <td className="p-3">
                          {d.training_completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        </td>
                        <td className="p-3 text-muted-foreground">{d.training_completed_date || '–'}</td>
                        <td className="p-3 font-medium">{d.total_deliveries || 0}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}