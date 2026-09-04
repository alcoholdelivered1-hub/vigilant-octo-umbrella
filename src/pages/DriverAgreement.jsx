import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Check } from 'lucide-react';

export default function DriverAgreement() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: 'Driver Independent Contractor Agreement – Alcohol Delivered', url });
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
          .print-page { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Driver Independent Contractor Agreement</h1>
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
          <p className="text-xs text-gray-500 uppercase tracking-widest">Independent Contractor Agreement</p>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">DRIVER CONTRACTOR AGREEMENT</h2>
          <p className="text-gray-600">Between <strong>Alcohol Delivered, LLC</strong> ("Company") and the Driver identified below</p>
        </div>

        {/* Effective Date */}
        <div className="text-center text-sm text-gray-600">
          This Agreement is entered into as of: <span className="inline-block border-b border-gray-400 w-40 mx-2 align-bottom" />
        </div>

        {/* Driver Info Fields */}
        <div className="grid grid-cols-2 gap-6 border rounded-xl p-5 bg-gray-50">
          <div className="space-y-3">
            <Field label="Driver Full Name" />
            <Field label="Date of Birth" />
            <Field label="Driver's License Number" />
            <Field label="State of License" />
          </div>
          <div className="space-y-3">
            <Field label="Phone Number" />
            <Field label="Email Address" />
            <Field label="Vehicle Make / Model / Year" />
            <Field label="License Plate Number" />
          </div>
        </div>

        <Section title="1. INDEPENDENT CONTRACTOR STATUS">
          <p>
            The Driver is engaged by Alcohol Delivered, LLC as an <strong>independent contractor</strong>, not as an employee.
            Nothing in this Agreement shall be construed to create an employer-employee relationship, partnership,
            joint venture, or agency between the Company and the Driver.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>The Driver is responsible for payment of all federal and state income taxes on earnings received under this Agreement (IRS Form 1099-NEC will be issued if earnings are $600 or more in a calendar year).</li>
            <li>The Driver is not entitled to employee benefits, including workers' compensation, unemployment insurance, health insurance, or retirement benefits.</li>
            <li>The Driver sets their own schedule and is free to accept or decline delivery assignments at their discretion.</li>
            <li>The Driver may perform services for other platforms or clients, provided such work does not conflict with this Agreement or violate any applicable law.</li>
            <li>The Driver supplies and maintains their own vehicle, phone, and any equipment necessary to perform deliveries.</li>
          </ul>
        </Section>

        <Section title="2. ARKANSAS ABC COMPLIANCE (ACT 157)">
          <p className="mb-2">As a condition of performing alcohol deliveries under this Agreement, the Driver must meet and maintain all requirements of Arkansas ACT 157 (A.C.A. §3-4-1101 – §3-4-1106):</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Must be <strong>21 years of age or older</strong> at all times during this Agreement.</li>
            <li>Must hold a <strong>valid Arkansas driver's license</strong> (or valid out-of-state license if permitted).</li>
            <li>Must have <strong>no felony convictions</strong> at any time. Discovery of a disqualifying conviction will result in immediate termination.</li>
            <li>Must successfully complete the Company's <strong>ABC-approved Driver Training Program</strong> prior to making any deliveries.</li>
            <li>Must <strong>verify the government-issued ID</strong> of every recipient at the point of delivery and confirm they are 21+.</li>
            <li>Must <strong>refuse delivery</strong> to any person who appears visibly intoxicated, regardless of age.</li>
            <li>Must only deliver within <strong>legally permitted wet areas</strong> — same county or adjacent wet county as the originating licensed retailer.</li>
            <li>Must only deliver during <strong>legally permitted alcohol sale hours</strong> for the delivery jurisdiction.</li>
            <li>Must <strong>never deliver to an unattended location</strong> — all deliveries require a live, in-person handoff.</li>
          </ul>
        </Section>

        <Section title="3. APPEARANCE & PROFESSIONAL STANDARDS">
          <p className="mb-2">
            Although the Driver is an independent contractor, the Company may enforce general professional appearance
            standards to protect public safety and brand integrity. The following standards apply while the Driver
            is actively performing deliveries on behalf of the Company:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Clothing must be <strong>clean and free of stains, rips, or tears</strong>.</li>
            <li>No clothing bearing <strong>offensive logos, language, or imagery</strong> (including profanity, violence, or discriminatory symbols).</li>
            <li>Drivers are required to wear <strong>pants or shorts of reasonable length</strong> — no underwear or swimwear as outerwear.</li>
            <li>Drivers are encouraged (but not required) to wear the Company-provided shirt or badge during deliveries.</li>
            <li>Personal hygiene must be maintained at a level appropriate for face-to-face customer interactions.</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500 italic">
            Note: The Company enforces only general, non-discriminatory appearance standards consistent with applicable law.
            Drivers retain the right to dress according to personal style outside of the above limitations.
          </p>
        </Section>

        <Section title="4. VEHICLE & INSURANCE REQUIREMENTS">
          <ul className="list-disc list-inside space-y-1">
            <li>The Driver must maintain a <strong>registered, roadworthy vehicle</strong> in compliance with all Arkansas state laws.</li>
            <li>The Driver must carry <strong>personal auto insurance</strong> meeting Arkansas minimum liability requirements at all times.</li>
            <li>The Driver is solely responsible for any accidents, citations, or damages arising from their use of their personal vehicle.</li>
            <li>No open alcohol containers are permitted in the driver area of the vehicle at any time while on duty.</li>
            <li>The Company's commercial auto insurance covers operations only where required by law and does not replace the Driver's personal coverage.</li>
          </ul>
        </Section>

        <Section title="5. COMPENSATION">
          <ul className="list-disc list-inside space-y-1">
            <li>The Driver earns a <strong>delivery fee per completed delivery</strong>, as set by the Company and communicated via the platform.</li>
            <li>A <strong>mileage surcharge</strong> of $1.00 per mile is earned for deliveries exceeding 7 miles from the retailer — this amount is paid entirely to the Driver.</li>
            <li>The Driver receives <strong>100% of any customer tips</strong> left through the platform.</li>
            <li>Payments are made on a <strong>weekly basis</strong> via Stripe Connect direct deposit or the Company's designated payment method.</li>
            <li>Earnings of <strong>$600 or more</strong> in a calendar year will result in the issuance of IRS Form 1099-NEC. The Driver is responsible for all applicable taxes on their earnings.</li>
            <li>No payment shall be issued for deliveries not completed, refused, or cancelled due to driver fault.</li>
          </ul>
        </Section>

        <Section title="6. DRIVER CONDUCT & PROHIBITED ACTIONS">
          <p>The Driver agrees not to:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Deliver alcohol to any person under 21 years of age.</li>
            <li>Deliver to a visibly intoxicated person.</li>
            <li>Consume alcohol before or during any delivery shift.</li>
            <li>Open, sample, or tamper with any sealed delivery package.</li>
            <li>Accept orders outside the Platform system or redirect customers for personal financial gain.</li>
            <li>Misrepresent their identity, qualifications, or training status to the Company or any customer.</li>
            <li>Operate a vehicle while under the influence of alcohol, drugs, or any impairing substance.</li>
            <li>Share login credentials or allow another person to operate under their Driver account.</li>
          </ul>
        </Section>

        <Section title="7. BACKGROUND CHECK CONSENT">
          <p>
            By signing this Agreement, the Driver consents to a criminal background check conducted by a
            third-party provider selected by the Company. The background check must return a "Clear" status before
            the Driver may begin deliveries. The Company reserves the right to conduct periodic background
            checks during the term of this Agreement. Any felony conviction discovered at any time will result
            in immediate termination of this Agreement.
          </p>
        </Section>

        <Section title="8. CONFIDENTIALITY">
          <p>
            The Driver agrees to keep confidential all customer information, order data, retailer information,
            and proprietary Platform information encountered during deliveries. The Driver shall not disclose,
            sell, or misuse any customer personal data obtained through the Platform.
          </p>
        </Section>

        <Section title="9. TERM AND TERMINATION">
          <ul className="list-disc list-inside space-y-1">
            <li>This Agreement begins on the date of signing and continues until terminated by either party.</li>
            <li>Either party may terminate this Agreement with <strong>7 days' written notice</strong>.</li>
            <li>The Company may terminate this Agreement <strong>immediately and without notice</strong> for: ABC violation, felony conviction, intoxicated driving, fraud, or any other material breach.</li>
            <li>Upon termination, the Driver must cease using all Company branding, materials, and system access.</li>
          </ul>
        </Section>

        <Section title="10. INDEMNIFICATION">
          <p>
            The Driver agrees to indemnify, defend, and hold harmless Alcohol Delivered, LLC and its officers,
            employees, and agents from any claims, damages, fines, or penalties arising from the Driver's own
            acts, omissions, negligence, or violation of any law or this Agreement during the performance of
            delivery services.
          </p>
        </Section>

        <Section title="11. GOVERNING LAW">
          <p>
            This Agreement shall be governed by the laws of the State of Arkansas. Any disputes shall be resolved
            in Jefferson County, Arkansas. This Agreement constitutes the entire understanding between the
            parties regarding the Driver's engagement and supersedes all prior agreements or representations.
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
              <p className="font-semibold text-xs uppercase tracking-wide text-gray-500">Driver / Independent Contractor</p>
              <SignatureLine label="Driver Signature" />
              <SignatureLine label="Printed Name" />
              <SignatureLine label="Driver's License #" />
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