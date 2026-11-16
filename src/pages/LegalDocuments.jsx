import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  FileText, ShieldCheck, ClipboardList, BookOpen, Scale, Lock, ArrowRight, Wine, Download, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const docs = [
  {
    icon: ShieldCheck,
    title: 'ABC Compliance Overview',
    desc: 'Complete ACT 157 compliance summary prepared for Arkansas ABC Division attorney review — dual age verification, driver training, zone enforcement, and full audit trail documentation.',
    path: '/abc-compliance',
    color: 'bg-emerald-100 text-emerald-700',
    tag: 'Attorney Review',
  },
  {
    icon: FileText,
    title: 'Retail Partner Agreement',
    desc: 'Third-Party Alcohol Delivery Agreement between Alcohol Delivered LLC and licensed retailers. Covers roles, fees, compliance obligations, and signatures.',
    path: '/retailer-contract',
    color: 'bg-blue-100 text-blue-700',
    tag: 'Legal Contract',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance & Audit Records',
    desc: 'Arkansas ABC compliance monitoring dashboard. Includes ID verification logs, refused delivery records, and driver training status.',
    path: '/admin/compliance',
    color: 'bg-emerald-100 text-emerald-700',
    tag: 'Compliance',
  },
  {
    icon: ClipboardList,
    title: 'ABC Compliance Checklist',
    desc: 'Complete Arkansas Third-Party Alcohol Delivery checklist covering all 26 regulatory requirements for Jefferson County / Pine Bluff operations.',
    path: '/admin/compliance',
    color: 'bg-violet-100 text-violet-700',
    tag: 'Regulatory',
  },
  {
    icon: BookOpen,
    title: 'Alcohol Safety Training Program',
    desc: 'Required customer-facing safety training covering Arkansas alcohol laws, responsible consumption, ID verification procedures, and community safety.',
    path: '/safety-training',
    color: 'bg-amber-100 text-amber-700',
    tag: 'Training',
  },
  {
    icon: Scale,
    title: 'Terms of Service',
    desc: 'Platform terms governing the use of Alcohol Delivered services, age requirements, order policies, liability limitations, and dispute resolution.',
    path: '/terms',
    color: 'bg-rose-100 text-rose-700',
    tag: 'Legal',
  },
  {
    icon: Lock,
    title: 'Privacy Policy',
    desc: 'How Alcohol Delivered collects, uses, and protects customer data including ID images, delivery addresses, and payment information.',
    path: '/privacy',
    color: 'bg-slate-100 text-slate-700',
    tag: 'Privacy',
  },
];

export default function LegalDocuments() {
  const [generatingPptx, setGeneratingPptx] = useState(false);

  const handleWorkflowPPTX = async () => {
    setGeneratingPptx(true);
    try {
      const res = await base44.functions.invoke('generateAppWorkflowPPTX', {});
      if (res.data?.download_url) {
        window.open(res.data.download_url, '_blank');
        toast.success('Presentation downloaded!');
      } else {
        toast.error(res.data?.error || 'Failed to generate presentation');
      }
    } catch (err) {
      toast.error(err?.message || 'Failed to generate presentation');
    } finally {
      setGeneratingPptx(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Scale className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">Legal Documents</h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
          All legal, compliance, and regulatory documentation for <strong>Alcohol Delivered LLC</strong>.
          This collection is intended for attorney review and Arkansas ABC compliance purposes.
        </p>
      </div>

      {/* Company Info Banner */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center">
              <Wine className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg">Alcohol Delivered LLC</p>
              <p className="text-primary-foreground/70 text-sm">Pine Bluff, Arkansas · Jefferson County</p>
            </div>
          </div>
          <div className="text-sm text-primary-foreground/70 space-y-0.5">
            <p>📞 870-209-9109</p>
            <p>🌐 alcohol-delivered.biz</p>
            <p>⚖️ AR Third-Party Delivery Permit</p>
          </div>
        </div>
      </div>

      {/* Document Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {docs.map((doc, i) => (
          <Link key={i} to={doc.path} className="group bg-card border rounded-2xl p-5 hover:shadow-md hover:border-primary/30 transition-all flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${doc.color}`}>
                <doc.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground border rounded-full px-2.5 py-1 mt-1">{doc.tag}</span>
            </div>
            <div>
              <h2 className="font-semibold text-base group-hover:text-primary transition-colors">{doc.title}</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{doc.desc}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary font-medium mt-auto pt-1">
              View Document <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        ))}
      </div>

      {/* App Workflow PPTX Banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-base">📊 App Workflow Presentation (for ABC)</p>
          <p className="text-sm text-muted-foreground mt-1">A visual PowerPoint showing every step of how our platform works — customer order → licensed store → dispatch → driver → delivery → compliance. Includes AI-generated images for each step. Designed for Arkansas ABC Division review.</p>
        </div>
        <Button onClick={handleWorkflowPPTX} disabled={generatingPptx} className="flex-shrink-0 gap-2">
          {generatingPptx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generatingPptx ? 'Generating…' : 'Download PPTX'}
        </Button>
      </div>

      {/* Attorney note */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <Scale className="w-4 h-4" /> Attorney Review Notes
        </p>
        <ul className="text-xs text-amber-700 space-y-1.5 list-disc list-inside mt-2">
          <li>The Retail Partner Agreement (Section 2) specifically references Arkansas ABC compliance requirements for third-party delivery permits.</li>
          <li>All deliveries are geo-fenced to wet counties and legally permitted hours per AR ABC Title 3.</li>
          <li>Dual age verification occurs at checkout (digital ID upload + AI verification) and at delivery (driver scan).</li>
          <li>ID verification records are maintained in the compliance dashboard for ABC inspection.</li>
          <li>Driver training program is required before any driver can go active on the platform.</li>
          <li>Platform does not hold title to or sell alcohol — retailer remains seller of record at all times.</li>
        </ul>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        © 2026 Alcohol Delivered LLC · Pine Bluff, AR · Confidential — for authorized review only
      </p>
    </div>
  );
}