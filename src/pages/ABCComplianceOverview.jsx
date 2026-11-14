import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck, Scale, BookOpen, CreditCard, MapPin, Truck, FileText,
  CheckCircle2, AlertTriangle, ArrowRight, Printer, Wine, ClipboardList, Building2, Phone, Globe, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const COMPANY = {
  name: 'Alcohol Delivered, LLC',
  location: 'Pine Bluff, Arkansas · Jefferson County',
  phone: '870-209-9109',
  website: 'alcohol-delivered.biz',
  permit: 'Arkansas Third-Party Alcohol Delivery Permit (ACT 157 / A.C.A. §3-4-1101)',
};

const COMPLIANCE_SECTIONS = [
  {
    id: 'permit',
    icon: FileText,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    title: 'Permit & Legal Authority',
    statute: 'A.C.A. §3-4-1101 through §3-4-1106 (ACT 157, 2025)',
    items: [
      'Operates under Arkansas Third-Party Alcohol Delivery Permit — $500/year fee paid to ABC Division',
      'Platform does NOT hold title to alcohol — licensed retailer remains the seller of record at all times',
      'All participating retailers hold valid Arkansas ABC retail licenses (license number on file per store)',
      'Delivery service is limited to wet counties/territories only — enforced by GPS zone check at order placement',
      'Deliveries are restricted to retailer\'s county or adjoining wet county per §3-4-1102',
    ],
  },
  {
    id: 'age',
    icon: CreditCard,
    color: 'bg-violet-100 text-violet-700 border-violet-200',
    title: 'Dual-Layer Age Verification',
    statute: 'A.C.A. §3-4-1103 — Proof of identity and age required at delivery',
    items: [
      'Step 1 at checkout: Customer uploads government-issued ID photo; AI-powered OCR extracts name, DOB, and expiration; system blocks order if under 21 or ID is expired',
      'Step 2 at delivery: Driver scans/photographs the physical ID in real time using in-app camera; second AI verification cross-references extracted name against order details',
      'Both verification events are timestamped and stored in the compliance audit log for ABC inspection',
      'Accepted IDs: Arkansas Driver\'s License, State ID, US Passport, US Military ID — expired IDs automatically rejected',
      'System logs GPS coordinates of each verification event for audit trail',
    ],
  },
  {
    id: 'driver',
    icon: Truck,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    title: 'Driver Eligibility & Training',
    statute: 'A.C.A. §3-4-1101(d) — Driver requirements; §3-4-1106 — Training program',
    items: [
      'All drivers must be 21+ with a valid driver\'s license and no felony convictions — verified at onboarding',
      'Mandatory ABC-approved training program covering: AR alcohol laws, responsible consumption, ID recognition, and wet/dry territory rules',
      'Training consists of 5 modules with embedded knowledge quizzes; passing score required before driver activation',
      'Training completion date and certification status stored per-driver in compliance dashboard',
      'Downloadable ABC-compliant training presentation (.pptx) available for regulatory review',
      'Arkansas Live Scan fingerprinting (background check) required — drivers receive unique reference code through the platform',
    ],
  },
  {
    id: 'delivery',
    icon: MapPin,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    title: 'Delivery Rules & Restrictions',
    statute: 'A.C.A. §3-4-1102 — Geographic restrictions; §3-4-1103 — Recipient requirements',
    items: [
      'Delivery is only available within wet zones — GPS zone check blocks orders placed from dry territory',
      'Legal delivery hours enforced per county (7:00 AM – 2:00 AM by default; configurable per zone)',
      'Delivery is only permitted to the person who placed the order, or a 21+ household/workplace member',
      'No unattended deliveries — driver must hand order directly to a verified adult recipient',
      'Driver can refuse delivery and log refusal reason (underage, expired ID, intoxicated, wrong person, no ID presented)',
      'Refusal events are permanently logged with reason, driver ID, and timestamp for ABC audit trail',
    ],
  },
  {
    id: 'records',
    icon: ClipboardList,
    color: 'bg-rose-100 text-rose-700 border-rose-200',
    title: 'Recordkeeping & Audit Trail',
    statute: 'A.C.A. §3-4-1105 — Record maintenance requirements',
    items: [
      'All orders stored with full delivery metadata: customer name, delivery address, GPS coordinates, timestamps, items, and totals',
      'ID verification records stored per order: verification type (checkout/delivery), ID image URL, verified-by driver, timestamp, GPS coordinates',
      'Refused deliveries logged with refusal reason, driver identity, and order details',
      'Driver training records with completion date and quiz scores stored per driver',
      'Daily sales reports generated and stored; exportable to Google Sheets for accounting',
      'Admin compliance dashboard available for real-time monitoring and ABC inspection (accessible at /admin/compliance)',
    ],
  },
  {
    id: 'zones',
    icon: Building2,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    title: 'Wet/Dry Zone Compliance',
    statute: 'A.C.A. §3-4-1102 — Wet area restriction',
    items: [
      'Delivery zones configured per county with wet/dry status — orders are blocked in dry territories at the API level',
      'Zone configuration includes GPS center, radius, legal hours start/end, delivery fee, and minimum order amount',
      'Zone editor allows admin to update wet/dry boundaries as ABC regulations change',
      'Each order records is_in_legal_zone flag at time of placement',
      'Interactive delivery zone map available for admin review at /admin/zones',
    ],
  },
  {
    id: 'consumer',
    icon: BookOpen,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    title: 'Consumer Safety Program',
    statute: 'A.C.A. §3-4-1106 — ABC-approved training program requirement',
    items: [
      'Customer-facing Alcohol Safety Training covers: AR alcohol laws, responsible consumption, ID verification, ACT 157 delivery rules, and community safety',
      'Training completion is logged to customer account and required before first order',
      'Responsible Consumer Certificate issued upon completion of all 5 modules',
      'Training content references AR Substance Abuse Helpline (1-800-482-9135)',
      'Training program downloadable as ABC-compliant PowerPoint for regulatory submission',
    ],
  },
];

function Section({ section }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;
  return (
    <div className={`border-2 rounded-2xl overflow-hidden ${section.color.split(' ')[2]}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-black/5 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${section.color.split(' ').slice(0, 2).join(' ')}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{section.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{section.statute}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-2">
          {section.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span className="text-foreground leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ABCComplianceOverview() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">

      {/* Print button (top right) */}
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </Button>
      </div>

      {/* Header */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold">ABC Compliance Overview</h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Prepared for Arkansas Alcoholic Beverage Control Division attorney review.
          Documents operational compliance with <strong>Arkansas ACT 157 (2025)</strong> and A.C.A. Title 3, Chapter 4.
        </p>
        <p className="text-xs text-muted-foreground">Prepared: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      {/* Company card */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
              <Wine className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-xl">{COMPANY.name}</p>
              <p className="text-primary-foreground/70 text-sm">{COMPANY.location}</p>
            </div>
          </div>
          <div className="text-sm text-primary-foreground/80 space-y-1">
            <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {COMPANY.phone}</p>
            <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {COMPANY.website}</p>
            <p className="flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> {COMPANY.permit}</p>
          </div>
        </div>
      </div>

      {/* Executive summary */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
        <p className="font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> Executive Compliance Summary
        </p>
        <p className="text-sm text-emerald-800 leading-relaxed">
          Alcohol Delivered, LLC operates a technology platform that facilitates alcohol delivery from licensed Arkansas retailers to consumers in compliance with ACT 157 (2025).
          The platform enforces <strong>dual-layer age verification</strong>, <strong>wet-zone geographic restrictions</strong>, <strong>mandatory driver training and background checks</strong>,
          and <strong>full delivery audit trails</strong> — all automated and enforced at the system level, not left to manual discretion.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {[
            { label: 'Age Verifications', value: '2× per order', sub: 'checkout + delivery' },
            { label: 'Driver Training', value: '5 modules', sub: 'quiz-based cert.' },
            { label: 'Zone Enforcement', value: 'GPS-locked', sub: 'wet counties only' },
            { label: 'Audit Records', value: 'Full log', sub: 'per order/driver' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-3 text-center border border-emerald-200">
              <p className="font-bold text-emerald-800">{stat.value}</p>
              <p className="text-xs font-semibold text-emerald-700">{stat.label}</p>
              <p className="text-xs text-emerald-600">{stat.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance sections */}
      <div className="space-y-4">
        {COMPLIANCE_SECTIONS.map(s => <Section key={s.id} section={s} />)}
      </div>

      {/* Links to live sections */}
      <div className="bg-card border rounded-2xl p-5 space-y-3">
        <p className="font-semibold flex items-center gap-2 text-sm"><ArrowRight className="w-4 h-4 text-primary" /> Live Platform Sections for Review</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { label: 'Safety Training Program', path: '/safety-training', desc: 'Customer-facing ACT 157 training' },
            { label: 'Compliance Dashboard', path: '/admin/compliance', desc: 'ID logs, refused deliveries, driver status' },
            { label: 'Delivery Zone Map', path: '/admin/zones', desc: 'Wet/dry zone configuration' },
            { label: 'Retailer Contract', path: '/retailer-contract', desc: 'Partner agreement with compliance clauses' },
            { label: 'Terms of Service', path: '/terms', desc: 'Consumer-facing legal terms' },
            { label: 'Privacy Policy', path: '/privacy', desc: 'ID data handling & retention' },
          ].map((link, i) => (
            <Link key={i} to={link.path}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border hover:border-primary/40 hover:bg-muted/50 transition-all group">
              <div>
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p>
            This document is a summary prepared for ABC attorney review. All operational features described herein are implemented and functional in the live platform.
            For a hands-on demonstration or source code review, please contact <strong>{COMPANY.phone}</strong>.
          </p>
          <p className="mt-2">
            <strong>Submitted to:</strong> Drew Cousins, Arkansas DFA Attorney —{' '}
            <a href="mailto:Drew.Cousins@dfa.arkansas.gov" className="underline hover:text-amber-900">
              Drew.Cousins@dfa.arkansas.gov
            </a>
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-6 print:block">
        © 2026 {COMPANY.name} · Pine Bluff, AR · Confidential — prepared for Arkansas ABC Division attorney review
      </p>
    </div>
  );
}