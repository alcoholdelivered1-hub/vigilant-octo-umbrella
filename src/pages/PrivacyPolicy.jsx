import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Check } from 'lucide-react';

function Section({ title, children }) {
  return (
    <div className="space-y-2">
      <h3 className="font-bold text-gray-900 border-b border-gray-200 pb-1">{title}</h3>
      {children}
    </div>
  );
}

export default function PrivacyPolicy() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: 'Privacy Policy – Alcohol Delivered', url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; font-size: 12pt; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Privacy Policy</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare} className="gap-2">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print / Save PDF
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-10 space-y-8 text-sm leading-relaxed text-gray-800">
        <div className="text-center border-b pb-6 space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Data Protection</p>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">PRIVACY POLICY</h2>
          <p className="text-gray-600"><strong>Alcohol Delivered LLC</strong> · Pine Bluff, Arkansas</p>
          <p className="text-xs text-gray-500">Effective Date: January 1, 2026 · Last Updated: May 2026</p>
        </div>

        <Section title="1. INTRODUCTION">
          <p>Alcohol Delivered LLC ("we," "us," "our") is committed to protecting the privacy and security of your personal information. This Privacy Policy explains how we collect, use, share, and protect your data when you use our alcohol delivery platform in compliance with applicable federal and Arkansas state privacy laws.</p>
          <p className="mt-2">By using our platform, you consent to the practices described in this Privacy Policy.</p>
        </Section>

        <Section title="2. INFORMATION WE COLLECT">
          <p className="font-semibold mt-2 mb-1">Information You Provide:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Identity Information:</strong> Full name, date of birth, government-issued ID (image and data extracted therefrom).</li>
            <li><strong>Contact Information:</strong> Email address, phone number, delivery address.</li>
            <li><strong>Payment Information:</strong> Credit/debit card details (processed and stored by Stripe — we do not store raw card numbers).</li>
            <li><strong>Order Information:</strong> Items ordered, store selected, order history, delivery preferences, notes.</li>
            <li><strong>Account Information:</strong> Username, password, account preferences.</li>
          </ul>
          <p className="font-semibold mt-3 mb-1">Information Collected Automatically:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Location Data:</strong> GPS coordinates at time of order placement and during delivery for zone verification and legal compliance.</li>
            <li><strong>Device Information:</strong> Browser type, IP address, device identifiers, operating system.</li>
            <li><strong>Usage Data:</strong> Pages visited, features used, time spent on platform.</li>
          </ul>
          <p className="font-semibold mt-3 mb-1">From Third Parties:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Payment processing information from Stripe.</li>
            <li>Delivery confirmation data from our drivers.</li>
          </ul>
        </Section>

        <Section title="3. HOW WE USE YOUR INFORMATION">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Age Verification:</strong> To verify that you are 21 or older as required by Arkansas law at checkout and delivery.</li>
            <li><strong>Order Processing:</strong> To fulfill your orders, communicate with retailers and drivers, and process payments.</li>
            <li><strong>Compliance:</strong> To maintain records required by Arkansas ABC including ID verification logs, delivery records, and refused delivery reports available for ABC inspection.</li>
            <li><strong>Legal Compliance:</strong> To comply with Arkansas alcoholic beverage laws, respond to lawful requests from government authorities, and prevent illegal activity.</li>
            <li><strong>Safety:</strong> To verify delivery zones (wet/dry counties), enforce legal delivery hours, and ensure deliveries occur only in lawful areas.</li>
            <li><strong>Communication:</strong> To send order confirmations, delivery updates, and important account notifications.</li>
            <li><strong>Platform Improvement:</strong> To analyze usage patterns and improve our services.</li>
            <li><strong>Fraud Prevention:</strong> To detect and prevent fraudulent orders or identity misrepresentation.</li>
          </ul>
        </Section>

        <Section title="4. ID IMAGE DATA — SPECIAL NOTICE">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
            <p className="font-semibold mb-1">Your ID Images Are Sensitive Data</p>
            <p>Government-issued ID images collected for age verification are:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
              <li>Stored in encrypted, secure cloud storage.</li>
              <li>Accessible only to authorized compliance personnel and Arkansas ABC upon lawful request.</li>
              <li><strong>Never sold or shared</strong> with third parties for marketing or commercial purposes.</li>
              <li>Retained for the period required by Arkansas ABC regulations, then securely deleted.</li>
              <li>Used solely for age verification and legal compliance purposes.</li>
            </ul>
          </div>
        </Section>

        <Section title="5. HOW WE SHARE YOUR INFORMATION">
          <p>We do not sell your personal information. We may share your information with:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Licensed Retailers:</strong> Your name, phone number, delivery address, and order details are shared with the retailer fulfilling your order.</li>
            <li><strong>Delivery Drivers:</strong> Your name, phone number, delivery address, and order details are shared with your assigned driver.</li>
            <li><strong>Payment Processor (Stripe):</strong> Payment information is processed by Stripe under their privacy policy.</li>
            <li><strong>Arkansas ABC:</strong> We are required by law to make compliance records (including ID verification logs) available to Arkansas ABC inspectors upon request.</li>
            <li><strong>Law Enforcement:</strong> In response to lawful court orders, subpoenas, or other legal processes.</li>
            <li><strong>Service Providers:</strong> Cloud storage, email, and analytics providers bound by confidentiality agreements.</li>
          </ul>
        </Section>

        <Section title="6. DATA RETENTION">
          <ul className="list-disc list-inside space-y-1">
            <li>Order records and ID verification logs are retained for a minimum of 3 years as required for ABC compliance audits.</li>
            <li>Payment records are retained as required by Stripe and applicable financial regulations.</li>
            <li>Account data is retained while your account is active and for 2 years after closure.</li>
            <li>You may request deletion of non-compliance data by contacting us (see Section 9).</li>
          </ul>
        </Section>

        <Section title="7. DATA SECURITY">
          <p>We implement industry-standard security measures including:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>SSL/TLS encryption for all data in transit.</li>
            <li>Encrypted cloud storage for sensitive data including ID images.</li>
            <li>Access controls limiting employee access to personal data on a need-to-know basis.</li>
            <li>Regular security assessments and monitoring.</li>
          </ul>
          <p className="mt-2">No method of electronic transmission is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.</p>
        </Section>

        <Section title="8. YOUR RIGHTS">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li><strong>Access:</strong> Request a copy of personal data we hold about you.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate personal data.</li>
            <li><strong>Deletion:</strong> Request deletion of your data, subject to our legal retention obligations.</li>
            <li><strong>Opt-Out:</strong> Opt out of non-essential marketing communications at any time.</li>
          </ul>
          <p className="mt-2">Note: We cannot delete data that we are legally required to retain for ABC compliance purposes.</p>
        </Section>

        <Section title="9. CHILDREN'S PRIVACY">
          <p>This platform is strictly intended for adults 21 years of age and older. We do not knowingly collect personal information from anyone under 21. If we become aware that we have collected data from a person under 21, we will immediately delete that information and cancel any associated orders.</p>
        </Section>

        <Section title="10. CHANGES TO THIS POLICY">
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting a notice on our platform. Your continued use of the platform after changes are posted constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="11. CONTACT US">
          <p>For privacy-related questions, requests, or concerns:</p>
          <div className="mt-2 bg-gray-50 rounded-xl p-4">
            <p className="font-semibold">Alcohol Delivered LLC</p>
            <p>Privacy Officer</p>
            <p>Pine Bluff, Arkansas</p>
            <p>Phone: 870-209-9109</p>
            <p>Website: alcohol-delivered.biz</p>
          </div>
        </Section>

        <p className="text-center text-xs text-gray-400 pt-4 border-t">
          © 2026 Alcohol Delivered LLC · Pine Bluff, AR · Confidential — for authorized review only.
        </p>
      </div>
    </div>
  );
}