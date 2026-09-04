import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { FileDown, Presentation, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SLIDES_OVERVIEW = [
  { num: '01', title: 'Company Overview & ABC Permit Status', desc: 'Company info, permit type, and compliance commitment' },
  { num: '02', title: 'Driver Eligibility Requirements', desc: 'ACT 157 statutory criteria — age, license, felony restrictions' },
  { num: '03', title: 'Application & Screening Process', desc: '7-step onboarding and Checkr background check flow' },
  { num: '04', title: 'Training Curriculum', desc: '5 ABC-compliant modules covering all required topics' },
  { num: '05', title: 'Certification & Record-Keeping', desc: 'Digital certificates, timestamped logs, audit-ready records' },
  { num: '06', title: 'Training Content — All 5 Modules', desc: '20 individual lesson slides from the live driver training program (5 modules × 4 lessons each)' },
];

export default function ABCPresentation() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setDone(false);
    try {
      const res = await base44.functions.invoke('generateDriverApprovalPPTX', {});
      if (res.data?.download_url) {
        const a = document.createElement('a');
        a.href = res.data.download_url;
        a.download = 'AlcoholDelivered_DriverApprovalProcess_ABC.pptx';
        a.click();
        setDone(true);
        toast.success('Presentation downloaded!');
      } else {
        throw new Error(res.data?.error || 'Unknown error');
      }
    } catch (err) {
      toast.error('Failed to generate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
          <Presentation className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">ABC Board Presentation</h1>
          <p className="text-muted-foreground mt-1">
            Driver Training & Approval Process — formatted for the Arkansas Alcoholic Beverage Control Division
          </p>
        </div>
      </div>

      {/* Slides preview */}
      <div className="bg-card border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">Presentation Contents (33 slides)</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Title + Overview */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
            <span className="text-xs font-bold text-secondary bg-secondary/10 rounded px-1.5 py-0.5 mt-0.5 shrink-0">00</span>
            <div>
              <p className="text-sm font-semibold">Title Slide + Presentation Overview</p>
              <p className="text-xs text-muted-foreground">Cover page & table of contents</p>
            </div>
          </div>
          {SLIDES_OVERVIEW.map((s) => (
            <div key={s.num} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <span className="text-xs font-bold text-secondary bg-secondary/10 rounded px-1.5 py-0.5 mt-0.5 shrink-0">{s.num}</span>
              <div>
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
            <span className="text-xs font-bold text-secondary bg-secondary/10 rounded px-1.5 py-0.5 mt-0.5 shrink-0">07</span>
            <div>
              <p className="text-sm font-semibold">Summary</p>
              <p className="text-xs text-muted-foreground">7-point closing summary for ABC reviewers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key details */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Format', val: 'PowerPoint (.pptx)', sub: 'Opens in PowerPoint, Google Slides, Keynote' },
          { label: 'Authority', val: 'ACT 157 (2025)', sub: 'A.C.A. §3-4-1101 through §3-4-1106' },
          { label: 'Recipient', val: 'ABC Division', sub: 'Arkansas Alcoholic Beverage Control' },
        ].map((d) => (
          <div key={d.label} className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{d.label}</p>
            <p className="font-semibold text-sm mt-1">{d.val}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{d.sub}</p>
          </div>
        ))}
      </div>

      {/* Generate button */}
      <Button
        size="lg"
        className="w-full gap-2 text-base h-12"
        onClick={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" />Generating Presentation…</>
        ) : done ? (
          <><CheckCircle2 className="w-5 h-5" />Downloaded — Generate Again</>
        ) : (
          <><FileDown className="w-5 h-5" />Generate & Download Presentation</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center mt-3">
        Takes about 15–20 seconds to build and download (33 slides).
      </p>
    </div>
  );
}