import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, Fingerprint, CheckCircle2, ExternalLink, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Hash } from 'lucide-react';
import { toast } from 'sonner';

const STATE_REQUIREMENTS = `Arkansas ABC State Requirements (ACT 157 of 2025):
• Criminal background check (state & federal)
• Arkansas Live Scan fingerprinting required
• No felony convictions (any time — ACT 157 §3-4-1101(d)(3))
• No DUI/DWI convictions within 3 years
• Must be 21 years of age or older (ACT 157 §3-4-1101(d)(1))
• Valid Arkansas driver's license required (ACT 157 §3-4-1101(d)(2))
• Completion of ABC-approved alcohol delivery training program (ACT 157 §3-4-1106)
• Employer must hold a Third-Party Delivery Permit ($500/yr annual fee)`;

const CITY_REQUIREMENTS = `City of Pine Bluff / Jefferson County Requirements:
• City of Pine Bluff business/peddler permit for delivery drivers
• Jefferson County Sheriff's Office background clearance
• Live Scan fingerprinting at Pine Bluff PD or Jefferson County Sheriff
• Proof of vehicle insurance (minimum AR state coverage)
• Valid city occupational license may be required
• Must comply with Pine Bluff Municipal Code § alcohol delivery ordinances
• No outstanding Pine Bluff/Jefferson County warrants
• Alcohol Awareness Training certificate (TIPS or equivalent)`;

function CopyButton({ text }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg bg-white/60 hover:bg-white transition-colors border border-current/20"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const LIVESCAN_SITES = [
  { name: 'Pine Bluff Police Department', address: '200 E 8th Ave, Pine Bluff, AR 71601', phone: '(870) 543-5100' },
  { name: 'Jefferson County Sheriff', address: '410 E 2nd Ave, Pine Bluff, AR 71601', phone: '(870) 541-5351' },
  { name: 'IdentoGO (IDEMIA) – Little Rock', address: 'Multiple AR locations', phone: '1-800-440-2511', url: 'https://uenroll.identogo.com/' },
];

function generateRefCode(user) {
  const prefix = (user?.full_name || 'DRV').replace(/\s+/g, '').toUpperCase().slice(0, 4);
  const suffix = (user?.id || '').slice(-6).toUpperCase();
  return `AD-${prefix}-${suffix}`;
}

export default function BackgroundCheck({ onComplete }) {
  const [step, setStep] = useState('info'); // info | form | submitted
  const [showSites, setShowSites] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refCode, setRefCode] = useState('');
  const [refCopied, setRefCopied] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      if (user) setRefCode(generateRefCode(user));
    }).catch(() => {});
  }, []);

  const copyRefCode = () => {
    navigator.clipboard.writeText(refCode).catch(() => {});
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 2000);
    toast.success('Reference code copied!');
  };

  const [form, setForm] = useState({
    full_name: '',
    ssn_last4: '',
    dob: '',
    consent: false,
    livescan_completed: false,
    livescan_location: '',
    livescan_date: '',
  });

  const handleSubmit = async () => {
    if (!form.full_name || !form.ssn_last4 || !form.dob) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!form.consent) {
      toast.error('You must consent to the background check');
      return;
    }
    setSaving(true);
    try {
      const user = await base44.auth.me();
      const submittedAt = new Date().toISOString();
      await base44.auth.updateMe({
        background_check_submitted: true,
        background_check_date: submittedAt,
        livescan_completed: form.livescan_completed,
        livescan_location: form.livescan_location,
        livescan_date: form.livescan_date,
      });
      const drivers = await base44.entities.Driver.filter({ email: user.email }, '-created_date', 100);
      await Promise.all(drivers.map(driver => base44.entities.Driver.update(driver.id, { background_check_submitted_at: submittedAt })));
      setStep('submitted');
      toast.success('Background check submission recorded!');
      if (onComplete) onComplete();
    } catch (e) {
      toast.error('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  if (step === 'submitted') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
        <h3 className="font-semibold text-emerald-800 text-lg">Submission Recorded</h3>
        <p className="text-sm text-emerald-700">Your background check consent has been submitted. An admin will review and approve your driver account once the check clears.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Background Check & Live Scan</h3>
          <p className="text-xs text-muted-foreground">Required by Arkansas ABC for alcohol delivery drivers</p>
        </div>
      </div>

      {/* Reference Code */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Hash className="w-4 h-4" />
          <p className="text-sm font-semibold">Your Background Check Reference Code</p>
        </div>
        <p className="text-xs opacity-80 leading-relaxed">
          Bring this code to the <strong>Pine Bluff Police Department</strong> or <strong>Jefferson County Sheriff's Office</strong> when completing your background check. This links your check to your Alcohol Delivered driver account.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-center">
            {refCode || 'Loading…'}
          </div>
          <button
            onClick={copyRefCode}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 text-sm font-medium transition-colors"
          >
            {refCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {refCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="text-xs opacity-70 text-center">Present this at the station — they will record it on your background check paperwork</p>
      </div>

      {/* Requirements */}
      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-blue-800">🏛️ Arkansas State Requirements (ABC)</p>
            <span className="text-blue-700"><CopyButton text={STATE_REQUIREMENTS} /></span>
          </div>
          <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
            <li>Criminal background check (state &amp; federal)</li>
            <li>Arkansas Live Scan fingerprinting required</li>
            <li><strong>No felony convictions</strong> — any time (ACT 157 §3-4-1101(d)(3))</li>
            <li>No DUI/DWI convictions within 3 years</li>
            <li>Must be 21 years of age or older (ACT 157 §3-4-1101(d)(1))</li>
            <li>Valid driver's license required (ACT 157 §3-4-1101(d)(2))</li>
            <li>Must complete ABC-approved delivery training program (ACT 157 §3-4-1106)</li>
          </ul>
          <a
            href="https://arkleg.state.ar.us/Acts/FTPDocument?path=%2FACTS%2F2025R%2FPublic%2F&file=157.pdf&ddBienniumSession=2025%2F2025R"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-800 font-semibold hover:underline mt-1"
          >
            View ACT 157 Full Text <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-purple-800">🏙️ City of Pine Bluff / Jefferson County</p>
            <span className="text-purple-700"><CopyButton text={CITY_REQUIREMENTS} /></span>
          </div>
          <ul className="text-xs text-purple-700 space-y-1.5 list-disc list-inside">
            <li>City of Pine Bluff business/peddler permit for delivery drivers</li>
            <li>Jefferson County Sheriff's Office background clearance</li>
            <li>Live Scan fingerprinting at Pine Bluff PD or Jefferson County Sheriff</li>
            <li>Proof of vehicle insurance (minimum AR state coverage)</li>
            <li>Valid city occupational license may be required</li>
            <li>Must comply with Pine Bluff Municipal Code § alcohol delivery ordinances</li>
            <li>No outstanding Pine Bluff/Jefferson County warrants</li>
            <li>Alcohol Awareness Training certificate (TIPS or equivalent)</li>
          </ul>
          <a
            href="https://www.cityofpinebluff-ar.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-purple-800 font-semibold hover:underline mt-1"
          >
            City of Pine Bluff Official Site <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Live Scan Locations */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSites(!showSites)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-primary" />
            Arkansas Live Scan Locations Near Pine Bluff
          </div>
          {showSites ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSites && (
          <div className="border-t divide-y">
            {LIVESCAN_SITES.map((site, i) => (
              <div key={i} className="px-4 py-3 space-y-0.5">
                <p className="text-sm font-medium">{site.name}</p>
                <p className="text-xs text-muted-foreground">{site.address}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{site.phone}</p>
                  {site.url && (
                    <a href={site.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline">
                      Book Online <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-card border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold">Submit Consent & Info</p>

        <div className="space-y-2">
          <Label>Full Legal Name *</Label>
          <Input
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            placeholder="As it appears on your government ID"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Date of Birth *</Label>
            <Input type="date" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Last 4 of SSN *</Label>
            <Input
              maxLength={4}
              value={form.ssn_last4}
              onChange={e => setForm({ ...form, ssn_last4: e.target.value.replace(/\D/, '') })}
              placeholder="XXXX"
            />
          </div>
        </div>

        {/* Live Scan completed? */}
        <div className="space-y-2">
          <Label>Have you completed Live Scan fingerprinting?</Label>
          <Select value={form.livescan_completed ? 'yes' : 'no'} onValueChange={v => setForm({ ...form, livescan_completed: v === 'yes' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No – not yet</SelectItem>
              <SelectItem value="yes">Yes – completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form.livescan_completed && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={form.livescan_location} onChange={e => setForm({ ...form, livescan_location: e.target.value })} placeholder="e.g. Pine Bluff PD" />
            </div>
            <div className="space-y-2">
              <Label>Date Completed</Label>
              <Input type="date" value={form.livescan_date} onChange={e => setForm({ ...form, livescan_date: e.target.value })} />
            </div>
          </div>
        )}

        {/* Consent */}
        <div
          className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setForm({ ...form, consent: !form.consent })}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${form.consent ? 'bg-primary border-primary' : 'border-border'}`}>
            {form.consent && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
          <p className="text-xs text-muted-foreground">
            I consent to a criminal background check and Arkansas Live Scan fingerprint check as required by state law for alcohol delivery drivers. I certify the information provided is accurate.
          </p>
        </div>

        {!form.livescan_completed && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            You must complete Live Scan before you can be approved to drive. Use the locations above to schedule your appointment.
          </div>
        )}

        <Button onClick={handleSubmit} disabled={saving} className="w-full h-11 rounded-xl">
          <ShieldCheck className="w-4 h-4 mr-2" />
          {saving ? 'Submitting…' : 'Submit Background Check Consent'}
        </Button>
      </div>
    </div>
  );
}