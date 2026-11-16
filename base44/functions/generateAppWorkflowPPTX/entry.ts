import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import PptxGenJS from 'npm:pptxgenjs@3.12.0';
import { assertAdmin } from '../../shared/authGuard.ts';

const BRAND_DARK = '1e3a5f';
const BRAND_GOLD = 'f59e0b';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'f1f5f9';
const EMERALD = '059669';
const TEXT_DARK = '1e293b';
const TEXT_MID = '475569';

// Each section = a party in the workflow
const WORKFLOW_SECTIONS = [
  {
    party: 'CUSTOMER',
    partyColor: '1e3a5f',
    title: 'Customer Places an Order',
    subtitle: 'Step-by-step: from app open to checkout',
    steps: [
      {
        step: 1,
        heading: 'Age Verification at Sign-Up',
        body: 'The customer downloads the Alcohol Delivered app and creates an account. They must confirm they are 21+ and complete the in-app Alcohol Safety Training course (required by ACT 157) before placing any order.',
        prompt: 'An adult using a smartphone app to sign up for a service, confirming their age with a date of birth field visible on screen, clean modern UI, photorealistic',
      },
      {
        step: 2,
        heading: 'Browse Licensed Stores & Products',
        body: 'The customer browses available licensed liquor stores near their delivery address. Only stores in wet counties within the customer\'s legal delivery zone are shown. Products display name, category, ABV, price, and stock status.',
        prompt: 'A person browsing an alcohol delivery app on a smartphone showing a grid of wine and spirit bottles from a local liquor store, modern app interface, photorealistic',
      },
      {
        step: 3,
        heading: 'ID Upload & Checkout',
        body: 'At checkout, the customer uploads a photo of their government-issued ID (driver\'s license, passport, state ID, or military ID). The system verifies the ID is valid and that the customer is 21+. Payment is processed via Stripe.',
        prompt: 'A person holding a driver\'s license next to their smartphone camera to upload it for age verification on an app, clean home background, photorealistic',
      },
      {
        step: 4,
        heading: 'Order Confirmation',
        body: 'Once payment is confirmed, the customer receives an order confirmation email with their order number, items, estimated delivery time, and tracking link. The order is simultaneously sent to the licensed retail store.',
        prompt: 'A person smiling at their phone reading an order confirmation notification, holding a credit card, sitting at a kitchen table, photorealistic',
      },
    ],
  },
  {
    party: 'LICENSED STORE',
    partyColor: '7c3aed',
    title: 'Licensed Retailer Receives & Prepares Order',
    subtitle: 'Retailer responsibilities under ACT 157',
    steps: [
      {
        step: 5,
        heading: 'Store Receives Order Notification',
        body: 'The licensed retailer receives an instant notification via email and SMS with full order details: customer name, items, quantities, and delivery address. The store\'s ABC license number is verified against the delivery zone before the order is accepted.',
        prompt: 'A liquor store employee at a counter receiving a notification on a tablet showing a new delivery order, bottles of wine and spirits on shelves in the background, photorealistic',
      },
      {
        step: 6,
        heading: 'Order Preparation & Inventory Check',
        body: 'The store staff picks and packs the ordered items. Inventory is automatically decremented in the system upon pickup confirmation. Items are sealed in a delivery bag. The retailer remains the seller of record for all alcohol sales.',
        prompt: 'A liquor store employee picking wine bottles from a shelf and placing them into a sealed delivery bag, professional retail environment, photorealistic',
      },
      {
        step: 7,
        heading: 'Order Marked Ready for Pickup',
        body: 'Once packed, the store marks the order as "Ready for Pickup" in the partner dashboard. This triggers an automatic notification to the nearest available qualified driver. The auto-dispatch system selects the driver based on proximity and availability.',
        prompt: 'A liquor store employee tapping a tablet screen to mark an order as ready, sealed delivery bags on the counter waiting for pickup, photorealistic',
      },
    ],
  },
  {
    party: 'DRIVER DISPATCH',
    partyColor: 'b45309',
    title: 'Auto-Dispatch & Driver Assignment',
    subtitle: 'ACT 157-qualified driver selection process',
    steps: [
      {
        step: 8,
        heading: 'Driver Qualification Requirements',
        body: 'Before a driver can receive any dispatch, they must: (1) be 21+ years old, (2) hold a valid driver\'s license, (3) have NO felony convictions (verified via background check), and (4) complete the ABC-approved Driver Training Program. All qualifications are stored in the driver profile.',
        prompt: 'A professional delivery driver in uniform holding a valid driver\'s license and a background check document, standing next to a clean vehicle, confident pose, photorealistic',
      },
      {
        step: 9,
        heading: 'Proximity-Based Auto-Dispatch',
        body: 'The system calculates the distance from each available qualified driver to the store. The nearest driver receives an instant push notification with order details, pickup address, delivery address, and estimated earnings. The driver can accept or the next closest is notified.',
        prompt: 'A GPS map on a smartphone screen showing a delivery route from a liquor store to a home address with a driver marker, mobile navigation interface, photorealistic',
      },
      {
        step: 10,
        heading: 'Driver Accepts & Heads to Store',
        body: 'The driver confirms acceptance of the delivery. Their status changes to "On Delivery" in the system. GPS tracking begins broadcasting the driver\'s real-time location, visible to the customer on their tracking screen and to admins on the live map.',
        prompt: 'A delivery driver sitting in a car accepting a delivery job on their phone, showing a route to a liquor store on the navigation screen, photorealistic',
      },
    ],
  },
  {
    party: 'PICKUP',
    partyColor: '0369a1',
    title: 'Driver Picks Up the Order',
    subtitle: 'Store-to-driver handoff procedures',
    steps: [
      {
        step: 11,
        heading: 'Driver Arrives at Store',
        body: 'The driver arrives at the licensed retail store and shows their driver ID to store staff. The store confirms the driver\'s identity and hands over the sealed delivery bag. The driver scans the order in the app to confirm pickup.',
        prompt: 'A delivery driver in uniform arriving at a liquor store entrance, showing their ID to a store employee at the counter, professional interaction, photorealistic',
      },
      {
        step: 12,
        heading: 'Pickup Confirmed — Transit Begins',
        body: 'The driver taps "Confirm Pickup" in the driver app. The order status updates to "In Transit" and the customer receives a real-time notification that their order is on the way with live GPS tracking enabled. The driver\'s route to the customer is displayed.',
        prompt: 'A delivery driver walking out of a liquor store carrying a sealed delivery bag toward their vehicle, smiling confidently, daytime suburban setting, photorealistic',
      },
    ],
  },
  {
    party: 'DELIVERY',
    partyColor: '059669',
    title: 'Driver Delivers to Customer',
    subtitle: 'Final mile compliance & ID verification at door',
    steps: [
      {
        step: 13,
        heading: 'Driver Arrives at Delivery Address',
        body: 'The driver arrives at the customer\'s delivery address. GPS location is recorded at the time of delivery for compliance audit purposes. The driver rings the doorbell and waits for the customer — no unattended deliveries are ever permitted under ACT 157.',
        prompt: 'A delivery driver standing at a residential front door ringing the doorbell, holding a sealed bag, daytime suburban neighborhood, photorealistic',
      },
      {
        step: 14,
        heading: 'ID Verification at the Door',
        body: 'Before handing over the order, the driver scans or visually inspects the customer\'s government-issued ID. The app verifies: (1) the ID belongs to the person who placed the order, (2) the customer is 21+, (3) the ID is not expired. The driver must refuse delivery if any check fails.',
        prompt: 'A delivery driver at a doorstep carefully examining a customer\'s driver\'s license held up to them, close-up of the ID being inspected, professional and respectful interaction, photorealistic',
      },
      {
        step: 15,
        heading: 'Intoxication Check',
        body: 'The driver is trained to assess whether the customer appears visibly intoxicated. If the recipient shows signs of intoxication — slurred speech, unsteady balance, disorientation — the driver must refuse the delivery per ACT 157 and company policy, and record the refusal reason in the app.',
        prompt: 'A delivery driver calmly but firmly holding up a hand to decline handing over a bag to a person at the door who appears unsteady, professional refusal scene, photorealistic',
      },
      {
        step: 16,
        heading: 'Order Handed Off & Confirmed',
        body: 'Once ID is verified and the customer is confirmed sober, the driver hands over the sealed bag. The customer signs digitally in the app. The delivery is marked "Delivered" with a timestamp, GPS coordinates, and ID verification record stored for ABC audit compliance.',
        prompt: 'A delivery driver handing a sealed bag to a smiling adult customer at the front door, the driver holding a phone for a digital signature, daytime, photorealistic',
      },
    ],
  },
  {
    party: 'COMPLIANCE & AUDIT',
    partyColor: 'dc2626',
    title: 'Compliance Records & ABC Oversight',
    subtitle: 'Full audit trail maintained per ACT 157',
    steps: [
      {
        step: 17,
        heading: 'ID Verification Audit Trail',
        body: 'Every ID scan is logged with: customer name, verification type (checkout or delivery), ID type, timestamp, GPS coordinates, and the driver who verified. All records are accessible in the compliance dashboard and available for ABC inspection at any time.',
        prompt: 'A compliance dashboard on a computer screen showing a table of ID verification records with timestamps, names, and checkmarks, clean professional admin interface, photorealistic',
      },
      {
        step: 18,
        heading: 'Refused Delivery Records',
        body: 'Every refused delivery is logged with reason, timestamp, GPS location, driver ID, and customer information. Common refusal reasons: underage, expired ID, apparent intoxication, wrong person at the door. These records demonstrate ACT 157 enforcement to ABC regulators.',
        prompt: 'An admin reviewing refused delivery reports on a tablet showing order details with red refusal flags and reasons listed, clean office setting, photorealistic',
      },
      {
        step: 19,
        heading: 'Driver Training & Certification Records',
        body: 'All driver training completions are logged with completion date, modules passed, quiz scores, and certification status. The ABC-approved training program covers: Arkansas alcohol laws, responsible consumption, ID verification, ACT 157, and community safety.',
        prompt: 'A delivery driver receiving a training certificate on a tablet screen showing "ABC Certified Driver Training Complete" with a gold seal, photorealistic',
      },
      {
        step: 20,
        heading: 'Zone Enforcement & Legal Delivery Area',
        body: 'Every delivery address is verified against the wet/dry county map before an order is accepted. Deliveries are restricted to wet counties within or adjoining the retailer\'s county. The system blocks orders to dry territories automatically — no manual override is possible.',
        prompt: 'A digital map of Arkansas counties with some highlighted in green (wet) and others in grey (dry), with a delivery pin within a legal green zone, clean infographic style',
      },
    ],
  },
];


function addTitleSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  // Gold top bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.5, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText('CONFIDENTIAL — FOR ARKANSAS ABC REVIEW', {
    x: 0.4, y: 0.1, w: 9.2, h: 0.3, fontSize: 10, bold: true,
    color: BRAND_DARK, align: 'center', fontFace: 'Calibri',
  });

  slide.addText('ALCOHOL DELIVERED', {
    x: 0.5, y: 1.1, w: 9, h: 0.8,
    fontSize: 40, bold: true, color: BRAND_GOLD,
    align: 'center', fontFace: 'Calibri',
  });
  slide.addText('How Our Platform Works', {
    x: 0.5, y: 2.0, w: 9, h: 0.55,
    fontSize: 24, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('End-to-End Workflow: Order → Store → Dispatch → Delivery → Compliance', {
    x: 0.5, y: 2.65, w: 9, h: 0.4,
    fontSize: 13, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 3, y: 3.2, w: 4, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  slide.addText([
    { text: 'Pine Bluff, Arkansas  ·  ', options: { color: 'aab4c4' } },
    { text: 'AR ABC Third-Party Delivery Permit Holder', options: { color: BRAND_GOLD } },
  ], { x: 0.5, y: 3.4, w: 9, h: 0.4, fontSize: 12, align: 'center', fontFace: 'Calibri' });

  slide.addText('ACT 157 (A.C.A. §3-4-1101 – §3-4-1106) Compliant Platform', {
    x: 0.5, y: 3.9, w: 9, h: 0.3, fontSize: 11, color: '6b7280', align: 'center', fontFace: 'Calibri',
  });
  slide.addText(`Prepared: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
    x: 0.5, y: 4.3, w: 9, h: 0.3, fontSize: 10, color: '6b7280', align: 'center', fontFace: 'Calibri',
  });
}

function addFlowOverviewSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT_GRAY };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.18, fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });
  slide.addText('PLATFORM OVERVIEW', {
    x: 0.4, y: 0.22, w: 9.2, h: 0.3, fontSize: 9, color: BRAND_GOLD, bold: true, fontFace: 'Calibri',
  });

  slide.addText('Complete Order Workflow', {
    x: 0.5, y: 0.65, w: 9, h: 0.55, fontSize: 26, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.25, w: 1.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const parties = [
    { label: '1. CUSTOMER', sub: 'Age verify, browse,\ncheckout, ID upload', color: '1e3a5f' },
    { label: '2. STORE', sub: 'Receive order,\npick & pack, ready', color: '7c3aed' },
    { label: '3. DISPATCH', sub: 'Qualify driver,\nauto-assign, GPS', color: 'b45309' },
    { label: '4. PICKUP', sub: 'Driver at store,\nconfirm & go', color: '0369a1' },
    { label: '5. DELIVERY', sub: 'ID check, sobriety\ncheck, handoff', color: '059669' },
    { label: '6. COMPLIANCE', sub: 'Audit trail, ABC\nrecords, reporting', color: 'dc2626' },
  ];

  const boxW = 1.45;
  const boxH = 1.5;
  const startX = 0.3;
  const y = 1.5;

  parties.forEach((p, i) => {
    const x = startX + i * (boxW + 0.08);
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: boxW, h: boxH,
      fill: { color: p.color }, line: { color: p.color },
      shadow: { type: 'outer', blur: 4, offset: 2, angle: 45, color: '94a3b8', opacity: 0.3 },
    });
    slide.addText(p.label, {
      x: x + 0.05, y: y + 0.12, w: boxW - 0.1, h: 0.45,
      fontSize: 10, bold: true, color: WHITE, fontFace: 'Calibri', align: 'center',
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: x + 0.3, y: y + 0.6, w: boxW - 0.6, h: 0.04,
      fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
    });
    slide.addText(p.sub, {
      x: x + 0.05, y: y + 0.72, w: boxW - 0.1, h: 0.65,
      fontSize: 9, color: 'e2e8f0', fontFace: 'Calibri', align: 'center', breakLine: true,
    });

    // Arrow between boxes
    if (i < parties.length - 1) {
      slide.addShape(pptx.ShapeType.rect, {
        x: x + boxW, y: y + boxH / 2 - 0.02, w: 0.08, h: 0.04,
        fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
      });
    }
  });

  // Step count summary
  slide.addText('20 compliance steps  ·  3 parties  ·  Full ABC audit trail  ·  Real-time GPS tracking', {
    x: 0.5, y: 3.2, w: 9, h: 0.4,
    fontSize: 12, color: TEXT_MID, fontFace: 'Calibri', align: 'center',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.1, w: 10, h: 0.27, fill: { color: LIGHT_GRAY }, line: { color: LIGHT_GRAY },
  });
  slide.addText('Alcohol Delivered  ·  Pine Bluff, AR  ·  AR ABC Third-Party Delivery Permit  ·  ACT 157 Compliant', {
    x: 0.4, y: 5.13, w: 9.2, h: 0.2, fontSize: 8, color: '94a3b8', fontFace: 'Calibri',
  });
}

function addSectionHeaderSlide(pptx, section, sectionNum) {
  const slide = pptx.addSlide();
  slide.background = { color: section.partyColor };

  slide.addText(`PHASE ${sectionNum}`, {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri', bold: true,
  });
  slide.addText(section.title, {
    x: 0.5, y: 1.6, w: 9, h: 0.8,
    fontSize: 28, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3, y: 2.5, w: 4, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText(section.subtitle, {
    x: 0.5, y: 2.7, w: 9, h: 0.4,
    fontSize: 14, color: 'e2e8f0', align: 'center', fontFace: 'Calibri',
  });
  slide.addText(`${section.steps.length} steps`, {
    x: 0.5, y: 3.3, w: 9, h: 0.35,
    fontSize: 13, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
  });
}

function addStepSlide(pptx, step, sectionTitle, partyColor, imageBase64) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  // Top accent bar in party color
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.22, fill: { color: partyColor }, line: { color: partyColor },
  });
  slide.addText(sectionTitle.toUpperCase(), {
    x: 0.4, y: 0.04, w: 7, h: 0.16, fontSize: 8, color: BRAND_GOLD, bold: true, fontFace: 'Calibri',
  });
  slide.addText(`STEP ${step.step}`, {
    x: 8.5, y: 0.04, w: 1.1, h: 0.16, fontSize: 8, color: WHITE, fontFace: 'Calibri', align: 'right', bold: true,
  });

  // Step number badge
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 0.35, y: 0.4, w: 0.55, h: 0.55,
    fill: { color: partyColor }, line: { color: partyColor },
  });
  slide.addText(`${step.step}`, {
    x: 0.35, y: 0.42, w: 0.55, h: 0.5,
    fontSize: 16, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
  });

  // Heading
  slide.addText(step.heading, {
    x: 1.05, y: 0.38, w: 5.1, h: 0.65,
    fontSize: 20, bold: true, color: TEXT_DARK, fontFace: 'Calibri',
  });

  // Gold accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.05, y: 1.08, w: 1.2, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  // Body text
  slide.addText(step.body, {
    x: 0.4, y: 1.25, w: 5.7, h: 3.55,
    fontSize: 14, color: TEXT_MID, fontFace: 'Calibri', valign: 'top',
    breakLine: true, lineSpacingMultiple: 1.45,
  });

  // AI Image on right
  if (imageBase64) {
    slide.addImage({
      data: `image/jpeg;base64,${imageBase64}`,
      x: 6.3, y: 0.45, w: 3.3, h: 4.3,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.3, y: 0.45, w: 3.3, h: 4.3,
      fill: { type: 'none' }, line: { color: 'e2e8f0', pt: 1 },
    });
  }

  // Bottom bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.1, w: 10, h: 0.27, fill: { color: LIGHT_GRAY }, line: { color: LIGHT_GRAY },
  });
  slide.addText('Alcohol Delivered  ·  Pine Bluff, AR  ·  ACT 157 Compliant  ·  AR ABC Third-Party Delivery Permit', {
    x: 0.4, y: 5.13, w: 9.2, h: 0.2, fontSize: 8, color: '94a3b8', fontFace: 'Calibri',
  });
}

function addComplianceSummarySlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.5, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText('FOR ARKANSAS ABC DIVISION REVIEW', {
    x: 0.4, y: 0.1, w: 9.2, h: 0.3, fontSize: 10, bold: true,
    color: BRAND_DARK, align: 'center', fontFace: 'Calibri',
  });

  slide.addText('ACT 157 Compliance Summary', {
    x: 0.5, y: 0.65, w: 9, h: 0.55,
    fontSize: 24, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.25, w: 2, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const checks = [
    { text: 'Dual age verification: digital ID upload at checkout + physical ID check at delivery', highlight: true },
    { text: 'No unattended deliveries — every handoff requires recipient presence and ID', highlight: true },
    { text: 'All drivers 21+, valid license, no felony convictions (background check on file)', highlight: false },
    { text: 'ABC-approved driver training program — completion logged per driver', highlight: false },
    { text: 'Deliveries restricted to wet counties within or adjoining retailer\'s county', highlight: false },
    { text: 'GPS location recorded at order placement, pickup, and delivery for full audit trail', highlight: false },
    { text: 'Refused delivery reasons logged: underage, expired ID, apparent intoxication, wrong person', highlight: false },
    { text: 'Retailer holds ABC license; remains seller of record — platform is delivery agent only', highlight: false },
    { text: 'Company holds AR ABC Third-Party Delivery Permit ($500/yr); renewed annually', highlight: false },
  ];

  checks.forEach((c, i) => {
    const y = 1.4 + i * 0.42;
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y, w: 0.3, h: 0.3,
      fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
    });
    slide.addText('✓', {
      x: 0.4, y, w: 0.3, h: 0.3,
      fontSize: 10, color: BRAND_DARK, align: 'center', bold: true, fontFace: 'Calibri',
    });
    slide.addText(c.text, {
      x: 0.85, y: y + 0.02, w: 9, h: 0.3,
      fontSize: 11, color: c.highlight ? BRAND_GOLD : 'cbd5e1', fontFace: 'Calibri', bold: c.highlight,
    });
  });
}

function addClosingSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.5, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText('ALCOHOL DELIVERED, LLC', {
    x: 0.4, y: 0.1, w: 9.2, h: 0.3, fontSize: 12, bold: true,
    color: BRAND_DARK, align: 'center', fontFace: 'Calibri',
  });

  slide.addText('Delivering Responsibly.', {
    x: 0.5, y: 1.2, w: 9, h: 0.7,
    fontSize: 34, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('Every step designed for ABC compliance.', {
    x: 0.5, y: 2.0, w: 9, h: 0.45,
    fontSize: 16, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 3, y: 2.6, w: 4, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const contactLines = [
    '📍  Pine Bluff, Arkansas — Jefferson County',
    '📞  870-209-9109',
    '🌐  alcohol-delivered.biz',
    '⚖️  AR ABC Third-Party Delivery Permit Holder',
  ];
  contactLines.forEach((line, i) => {
    slide.addText(line, {
      x: 0.5, y: 2.85 + i * 0.42, w: 9, h: 0.35,
      fontSize: 13, color: i === 3 ? BRAND_GOLD : 'aab4c4', align: 'center', fontFace: 'Calibri',
    });
  });

  slide.addText('This document is confidential and prepared for Arkansas ABC Division review.', {
    x: 0.5, y: 4.7, w: 9, h: 0.25,
    fontSize: 9, color: '4b5563', align: 'center', fontFace: 'Calibri',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response, user } = await assertAdmin(base44);
    if (!authorized) return response;

    console.log('Generating workflow PPTX (text-only, no image generation)...');

    // No image generation — build text-only slides for reliability
    const sectionImages = WORKFLOW_SECTIONS.map(section => section.steps.map(() => null));

    // Build PPTX
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Alcohol Delivered';
    pptx.company = 'Alcohol Delivered, LLC';
    pptx.subject = 'App Workflow — ACT 157 Compliance — Arkansas ABC Review';
    pptx.title = 'How Alcohol Delivered Works';

    addTitleSlide(pptx);
    addFlowOverviewSlide(pptx);

    WORKFLOW_SECTIONS.forEach((section, sIdx) => {
      addSectionHeaderSlide(pptx, section, sIdx + 1);
      section.steps.forEach((step, stepIdx) => {
        addStepSlide(pptx, step, section.party, section.partyColor, sectionImages[sIdx][stepIdx] || null);
      });
    });

    addComplianceSummarySlide(pptx);
    addClosingSlide(pptx);

    // Export
    const base64 = await pptx.write({ outputType: 'base64' });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const file = new File([blob], 'AlcoholDelivered_HowItWorks_ABCReview.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    console.log('Workflow PPTX uploaded:', file_url);
    return Response.json({ success: true, download_url: file_url });

  } catch (error) {
    console.error('generateAppWorkflowPPTX error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});