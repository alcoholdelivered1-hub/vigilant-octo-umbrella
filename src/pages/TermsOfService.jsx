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

export default function TermsOfService() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: 'Terms of Service – Alcohol Delivered', url });
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
        <h1 className="font-display text-2xl font-bold">Terms of Service</h1>
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
          <p className="text-xs text-gray-500 uppercase tracking-widest">Platform Agreement</p>
          <h2 className="text-2xl font-bold text-gray-900 font-serif">TERMS OF SERVICE</h2>
          <p className="text-gray-600"><strong>Alcohol Delivered, LLC</strong> · Pine Bluff, Arkansas</p>
          <p className="text-xs text-gray-500">Effective Date: January 1, 2026 · Last Updated: May 2026</p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-xs">
          <strong>AGE REQUIREMENT:</strong> You must be 21 years of age or older to use this platform. By using Alcohol Delivered, you confirm that you are at least 21 years old and legally permitted to purchase alcohol under the laws of the State of Arkansas.
        </div>

        <Section title="1. ACCEPTANCE OF TERMS">
          <p>By accessing or using the Alcohol Delivered platform (website, mobile application, or any related service), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this platform.</p>
        </Section>

        <Section title="2. DESCRIPTION OF SERVICE">
          <p>Alcohol Delivered, LLC ("Company," "we," "us") operates a third-party alcohol delivery platform that connects customers with licensed Arkansas alcohol retailers. We are <strong>not</strong> a retailer or seller of alcohol. The licensed retailer is the seller of record for all transactions. We provide technology, logistics coordination, and delivery services only.</p>
          <p className="mt-2">We operate under a valid Arkansas Third-Party Alcohol Delivery Permit as authorized under Arkansas Code Annotated § 3-4-214 and applicable Arkansas Alcoholic Beverage Control (ABC) regulations.</p>
        </Section>

        <Section title="3. ELIGIBILITY">
          <ul className="list-disc list-inside space-y-1">
            <li>You must be 21 years of age or older.</li>
            <li>You must provide a valid, government-issued photo ID upon request (at checkout and at delivery).</li>
            <li>You must be located in a lawful wet jurisdiction in Arkansas at the time of your order.</li>
            <li>You must not be visibly intoxicated at the time of delivery.</li>
            <li>You must be the person who placed the order and be present to receive delivery.</li>
            <li>You must have a valid payment method on file.</li>
          </ul>
        </Section>

        <Section title="4. AGE VERIFICATION">
          <p>We are required by Arkansas law to verify the age of all customers. This verification occurs in two stages:</p>
          <ol className="list-decimal list-inside space-y-1 mt-2">
            <li><strong>At Checkout:</strong> You must confirm your date of birth and acknowledge that your ID will be checked at delivery.</li>
            <li><strong>At Delivery:</strong> Our driver will inspect your physical government-issued ID before handing over any order. Delivery will be refused if you cannot present a valid ID, if the ID does not match the order, or if you appear intoxicated.</li>
          </ol>
          <p className="mt-2">Accepted ID types: Arkansas Driver's License, State-issued ID card, US Passport or Passport Card, US Military ID. All IDs must be current and not expired.</p>
        </Section>

        <Section title="5. DELIVERY RESTRICTIONS">
          <ul className="list-disc list-inside space-y-1">
            <li>Deliveries are only available in lawful wet counties and jurisdictions in Arkansas.</li>
            <li>Deliveries may only be placed and fulfilled during legally permitted alcohol sale hours in your area (typically 7:00 AM – 2:00 AM).</li>
            <li>Delivery must be made to the person who placed the order. Unattended delivery is not permitted under any circumstances.</li>
            <li>Delivery will be refused to any person under 21, any person who appears intoxicated, or at any address in a dry jurisdiction.</li>
            <li>Delivery areas are limited to Jefferson County and surrounding wet counties served by our licensed retail partners.</li>
          </ul>
        </Section>

        <Section title="6. ORDERS AND PAYMENT">
          <ul className="list-disc list-inside space-y-1">
            <li>All prices displayed are set by the licensed retailer. Prices are subject to change without notice.</li>
            <li>A service fee of 25% of the product subtotal is charged by the Platform for technology and logistics services.</li>
            <li>A delivery fee is charged per delivery based on your zone.</li>
            <li>Applicable Arkansas sales tax (6.5%) is applied to all orders.</li>
            <li>Optional driver tips may be added at checkout.</li>
            <li>Payment is processed securely via Stripe. We do not store your credit card information.</li>
            <li>Orders are confirmed only after successful payment processing.</li>
          </ul>
        </Section>

        <Section title="7. CANCELLATIONS AND REFUNDS">
          <ul className="list-disc list-inside space-y-1">
            <li>Orders may be cancelled before the retailer confirms preparation. Contact us immediately at 870-209-9109.</li>
            <li>Once an order is being prepared or is in transit, cancellations may not be possible.</li>
            <li>Refunds will be issued if: (a) the retailer is unable to fulfill your order, (b) incorrect items were delivered, or (c) delivery was refused due to a Platform error.</li>
            <li>No refunds will be issued if delivery is refused because you could not present a valid ID, were underage, or were intoxicated.</li>
            <li>Refunds are processed to your original payment method within 5-10 business days.</li>
          </ul>
        </Section>

        <Section title="8. PROHIBITED USES">
          <p>You may not use this platform to:</p>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>Purchase alcohol if you are under 21 years of age.</li>
            <li>Purchase alcohol on behalf of any person under 21 (furnishing to a minor).</li>
            <li>Provide false identification or misrepresent your age or identity.</li>
            <li>Place orders for delivery outside lawful wet jurisdictions.</li>
            <li>Resell any alcohol purchased through this platform.</li>
            <li>Engage in any fraudulent, illegal, or abusive activity.</li>
          </ul>
          <p className="mt-2">Violation of these prohibitions may result in immediate account termination, reporting to Arkansas ABC, and/or referral to law enforcement.</p>
        </Section>

        <Section title="9. LIMITATION OF LIABILITY">
          <p>To the maximum extent permitted by Arkansas law, Alcohol Delivered, LLC shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of this platform. Our total liability to you for any claim shall not exceed the amount you paid for the specific order giving rise to the claim.</p>
          <p className="mt-2">We are not responsible for: product quality (the responsibility of the licensed retailer), delays caused by traffic or weather, or damages resulting from your own negligence or misuse of the platform.</p>
        </Section>

        <Section title="10. INTELLECTUAL PROPERTY">
          <p>All content on this platform including design, text, graphics, logos, and software is the property of Alcohol Delivered, LLC and is protected by applicable intellectual property laws. You may not copy, reproduce, or distribute any content without prior written consent.</p>
        </Section>

        <Section title="11. PRIVACY">
          <p>Your use of this platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the platform, you consent to the collection and use of your information as described in our Privacy Policy.</p>
        </Section>

        <Section title="12. MODIFICATIONS">
          <p>We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the platform. Your continued use of the platform after changes are posted constitutes your acceptance of the revised Terms.</p>
        </Section>

        <Section title="13. GOVERNING LAW AND DISPUTE RESOLUTION">
          <p>These Terms shall be governed by the laws of the State of Arkansas. Any dispute arising from these Terms or your use of the platform shall be resolved exclusively in the state or federal courts of Jefferson County, Arkansas. You consent to the personal jurisdiction of such courts.</p>
        </Section>

        <Section title="14. CONTACT">
          <p>For questions about these Terms, contact us at:</p>
          <div className="mt-2 bg-gray-50 rounded-xl p-4">
            <p className="font-semibold">Alcohol Delivered, LLC</p>
            <p>Pine Bluff, Arkansas</p>
            <p>Phone: 870-209-9109</p>
            <p>Website: alcohol-delivered.biz</p>
          </div>
        </Section>

        <p className="text-center text-xs text-gray-400 pt-4 border-t">
          © 2026 Alcohol Delivered, LLC · Pine Bluff, AR · All rights reserved.
        </p>
      </div>
    </div>
  );
}