import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, Award, BookOpen, CheckCircle2, Download, Share2,
  Printer, ExternalLink, Loader2, Scale, Truck, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MODULES = [
  {
    id: 'laws',
    icon: '⚖️',
    title: 'Arkansas Alcohol Delivery Laws',
    lessons: 4,
    topics: [
      'Legal drinking age: 21+',
      'Correct delivery hours (Mon–Fri 7am–1am, Sat 7am–12am)',
      'Wet, dry, and damp area rules',
      'Third‑party delivery permit restrictions'
    ]
  },
  {
    id: 'id_verification',
    icon: '🪪',
    title: 'ID Verification Requirements',
    lessons: 4,
    topics: [
      'Accepted forms of ID',
      'Matching ID to the order',
      'Checking expiration & validity',
      'Refusing delivery when ID is invalid'
    ]
  },
  {
    id: 'delivery_rules',
    icon: '🚚',
    title: 'Driver Delivery Responsibilities',
    lessons: 4,
    topics: [
      'Deliver only to the person who placed the order',
      'Refuse delivery if customer appears intoxicated',
      'Verify address eligibility using ABC GIS map',
      'No deliveries outside legal hours'
    ]
  },
  {
    id: 'payments',
    icon: '💳',
    title: 'Orders & Payments',
    lessons: 4,
    topics: [
      'Orders placed through app/website only',
      'Payment processed in‑app (drivers never collect money)',
      'Driver role: verify ID & complete delivery',
      'No cash handling or refunds by drivers'
    ]
  },
  {
    id: 'refusals',
    icon: '⛔',
    title: 'When You Must Refuse Delivery',
    lessons: 4,
    topics: [
      'Customer under 21',
      'Invalid or expired ID',
      'Customer intoxicated',
      'Address in a dry or restricted area'
    ]
  }
];

  

export default function DriverTrainingOverview() {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadingWorkflow, setDownloadingWorkflow] = useState(false);
  const [downloadingTraining, setDownloadingTraining] = useState(false);

  const handleDownloadTrainingPPTX = async () => {
    setDownloadingTraining(true);
    toast('Generating Training PowerPoint…', { description: 'This may take 60–90 seconds.' });
    try {
      const res = await base44.functions.invoke('generateTrainingPPTX', {});
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
        toast.success('Training PowerPoint downloaded!');
      } else {
        toast.error(res.data?.error || 'Failed to generate PowerPoint');
      }
    } catch {
      toast.error('Failed to generate. Please try again.');
    } finally {
      setDownloadingTraining(false);
    }
  };

  const handleDownloadWorkflowPPTX = async () => {
    setDownloadingWorkflow(true);
    toast('Generating App Workflow PowerPoint…', { description: 'Generating AI images for all 20 steps. This may take 60–90 seconds.' });
    try {
      const res = await base44.functions.invoke('generateAppWorkflowPPTX', {});
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
        toast.success('App Workflow PowerPoint downloaded!');
      } else {
        toast.error(res.data?.error || 'Failed to generate PowerPoint');
      }
    } catch (err) {
      toast.error('Failed to generate. Please try again.');
    } finally {
      setDownloadingWorkflow(false);
    }
  };

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const handleDownloadCertificate = async () => {
    setDownloading(true);
    try {
      const res = await base44.functions.invoke('generateTrainingCertificate', {
        name: user?.full_name || user?.email || 'Driver',
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        modules: MODULES.map(m => m.title),
      });
      // res.data is the raw PDF ArrayBuffer from jsPDF
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `DriverTrainingCertificate.pdf`;
      link.click();
      toast.success('Certificate downloaded!');
    } catch (err) {
      toast.error('Failed to download certificate. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    const shareUrl = `${window.location.origin}/driver-training-overview`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Arkansas ACT 157 Driver Training Program — Alcohol Delivered',
          text: 'Review the complete Alcohol Delivery Driver Training Program required under Arkansas ACT 157.',
          url: shareUrl,
        });
        toast.success('Shared successfully!');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    } finally {
      setSharing(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8 print:py-4 print:px-2">

      {/* Print header (only shows when printing) */}
      <div className="hidden print:block text-center border-b-2 border-gray-300 pb-4 mb-4">
        <p className="text-xs text-gray-500">Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz · 870-209-9109</p>
        <p className="text-xs text-gray-500 mt-1">Prepared for Arkansas Alcoholic Beverage Control (ABC) Division Review</p>
      </div>

      {/* Header */}
      <div className="text-center space-y-3 print:space-y-1">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto print:hidden">
          <Truck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">Driver Training Program</h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto">
          Complete training curriculum required under <strong>Arkansas ACT 157 (A.C.A. §3-4-1106)</strong> for all
          Alcohol Delivered, LLC delivery drivers operating in Jefferson County / Pine Bluff, AR.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap justify-center gap-3 print:hidden">
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" /> Print for ABC
        </Button>
        <Button onClick={handleShare} variant="outline" className="gap-2" disabled={sharing}>
          {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          Share Link
        </Button>
        <Button onClick={handleDownloadCertificate} className="gap-2" disabled={downloading}>
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download My Certificate (PDF)
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => window.open('/safety-training', '_blank')}>
          <ExternalLink className="w-4 h-4" /> Take Training Now
        </Button>
        <Button onClick={handleDownloadWorkflowPPTX} variant="outline" className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-50" disabled={downloadingWorkflow}>
          {downloadingWorkflow ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloadingWorkflow ? 'Generating…' : 'How Our App Works (PPTX for ABC)'}
        </Button>
        <Button onClick={handleDownloadTrainingPPTX} variant="outline" className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-50" disabled={downloadingTraining}>
          {downloadingTraining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloadingTraining ? 'Generating…' : 'Training Slides (PPTX)'}
        </Button>
      </div>

      {/* Compliance summary banner */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6 print:border print:border-gray-400 print:bg-white print:text-black">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 opacity-80 flex-shrink-0" />
            <div>
              <p className="font-bold text-lg">ACT 157 Compliance Training</p>
              <p className="text-primary-foreground/70 text-sm print:text-gray-600">
                5 modules · 20 lessons · 15 quiz questions · Certificate issued upon completion
              </p>
            </div>
          </div>
          <div className="text-sm text-primary-foreground/70 print:text-gray-600 space-y-0.5 text-right">
            <p>📍 Pine Bluff, AR · Jefferson County</p>
            <p>⚖️ A.C.A. §3-4-1101 through §3-4-1106</p>
            <p>🗓 Updated May 2026</p>
          </div>
        </div>
      </div>

      {/* Legal requirements */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 print:border-gray-400">
        <p className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4" /> Legal Requirements Under ACT 157
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-amber-800">
          {[
            'Driver must be 21 years of age or older',
            'Valid driver\'s license required at all times',
            'No felony convictions (no timeframe exception)',
            'Complete training before first delivery',
            'Verify recipient ID at every delivery',
            'Refuse delivery if recipient cannot produce valid ID',
            'Never deliver to a minor under any circumstances',
            'Deliver only within wet counties/territories',
          ].map((req, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>{req}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modules */}
      <div>
        <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" /> Training Modules
        </h2>
        <div className="space-y-4">
          {MODULES.map((mod, idx) => (
            <div key={mod.id} className="bg-card border rounded-2xl p-5 print:break-inside-avoid">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 text-xl">
                  {mod.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Module {idx + 1}</span>
                  </div>
                  <h3 className="font-bold text-base">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{mod.lessons} lessons · quiz required (67% to pass)</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {mod.topics.map((topic, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0" />
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Certificate preview */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-8 text-primary-foreground text-center space-y-2 print:border print:border-gray-400 print:bg-white print:text-black">
        <Award className="w-10 h-10 mx-auto opacity-80" />
        <p className="font-display text-xl font-bold">Certificate of Completion</p>
        <p className="text-sm opacity-80 print:text-gray-600">
          Upon passing all 5 modules, drivers receive a personalized PDF certificate
          naming them as ACT 157 compliant, suitable for Arkansas ABC submission.
        </p>
        <p className="text-xs opacity-60 print:text-gray-500 mt-2">
          Certificate includes: driver name · completion date · modules completed · official seal
        </p>
      </div>

      {/* ABC attestation */}
      <div className="bg-card border rounded-2xl p-5 print:break-inside-avoid">
        <p className="font-semibold flex items-center gap-2 mb-3 text-sm">
          <ClipboardList className="w-4 h-4 text-primary" /> ABC Division Attestation
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Alcohol Delivered, LLC certifies that all active delivery drivers have completed this training program
          prior to conducting any alcohol deliveries. Training records are maintained in our compliance system
          and available for Arkansas ABC Division inspection upon request. This program satisfies the training
          requirements under A.C.A. §3-4-1106 and covers identification of underage/intoxicated persons,
          valid government-issued ID recognition, and wet/dry territory rules.
        </p>
        <div className="mt-4 pt-4 border-t grid sm:grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="font-bold text-2xl text-primary">5</p>
            <p className="text-muted-foreground text-xs">Required Modules</p>
          </div>
          <div>
            <p className="font-bold text-2xl text-primary">15</p>
            <p className="text-muted-foreground text-xs">Quiz Questions</p>
          </div>
          <div>
            <p className="font-bold text-2xl text-primary">67%</p>
            <p className="text-muted-foreground text-xs">Min. Passing Score</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground pb-4 print:text-gray-500">
        © 2026 Alcohol Delivered, LLC · Pine Bluff, AR · Jefferson County · 870-209-9109 · alcohol-delivered.biz
      </p>
    </div>
  );
}