import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import PptxGenJS from 'npm:pptxgenjs@3.12.0';
import { assertAdmin } from '../../shared/authGuard.ts';

const BRAND_DARK = '1e3a5f';
const BRAND_GOLD = 'f59e0b';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'f1f5f9';
const TEXT_DARK = '1e293b';
const TEXT_MID = '475569';
const GREEN = '16a34a';
const RED = 'dc2626';

function addHeader(slide, pptx, label) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.22, fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });
  if (label) {
    slide.addText(label.toUpperCase(), {
      x: 0.4, y: 0.03, w: 9.2, h: 0.18,
      fontSize: 9, color: BRAND_GOLD, bold: true, fontFace: 'Calibri',
    });
  }
}

function addFooter(slide, pptx) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.1, w: 10, h: 0.27, fill: { color: LIGHT_GRAY }, line: { color: LIGHT_GRAY },
  });
  slide.addText('Alcohol Delivered, LLC  ·  Pine Bluff, AR  ·  Arkansas ABC Third-Party Delivery Permit Holder', {
    x: 0.4, y: 5.13, w: 9.2, h: 0.2,
    fontSize: 8, color: '94a3b8', fontFace: 'Calibri',
  });
}

function addTitleSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addText('ALCOHOL DELIVERED, LLC', {
    x: 0.5, y: 0.9, w: 9, h: 0.6,
    fontSize: 32, bold: true, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('Driver Training & Approval Process', {
    x: 0.5, y: 1.65, w: 9, h: 0.55,
    fontSize: 24, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('Submitted to the Arkansas Alcoholic Beverage Control Division', {
    x: 0.5, y: 2.3, w: 9, h: 0.4,
    fontSize: 14, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.0, y: 2.85, w: 4, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText('Arkansas ACT 157 (2025)  ·  A.C.A. §3-4-1101 through §3-4-1106', {
    x: 0.5, y: 3.05, w: 9, h: 0.35,
    fontSize: 12, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
  });
  slide.addText([
    { text: 'Pine Bluff, Arkansas', options: { color: 'aab4c4' } },
    { text: `   ·   Prepared ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, options: { color: '6b7280' } },
  ], { x: 0.5, y: 3.55, w: 9, h: 0.35, fontSize: 12, align: 'center', fontFace: 'Calibri' });
}

function addOverviewSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addHeader(slide, pptx, 'Overview');
  addFooter(slide, pptx);

  slide.addText('Presentation Overview', {
    x: 0.5, y: 0.35, w: 9, h: 0.55,
    fontSize: 26, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 2, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const sections = [
    { num: '01', title: 'Company Overview & ABC Permit Status', desc: 'Who we are and our third-party delivery permit' },
    { num: '02', title: 'Driver Eligibility Requirements', desc: 'ACT 157 statutory criteria for all drivers' },
    { num: '03', title: 'Driver Application & Screening Process', desc: 'Step-by-step onboarding and background check flow' },
    { num: '04', title: 'Training Curriculum', desc: '5-module ABC-compliant training program' },
    { num: '05', title: 'Training Completion & Certification', desc: 'How we verify and record driver completion' },
    { num: '06', title: 'Training Content — All 5 Modules', desc: '20 individual lesson slides from the live driver training program' },
  ];

  sections.forEach((s, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = col === 0 ? 0.4 : 5.1;
    const y = 1.15 + row * 1.2;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 4.5, h: 1.05,
      fill: { color: i % 2 === 0 ? 'f8fafc' : 'fefce8' }, line: { color: 'e2e8f0', pt: 1 },
    });
    slide.addText(s.num, {
      x: x + 0.15, y: y + 0.08, w: 0.55, h: 0.45,
      fontSize: 20, bold: true, color: BRAND_GOLD, fontFace: 'Calibri',
    });
    slide.addText(s.title, {
      x: x + 0.75, y: y + 0.08, w: 3.6, h: 0.4,
      fontSize: 11, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
    });
    slide.addText(s.desc, {
      x: x + 0.75, y: y + 0.52, w: 3.6, h: 0.42,
      fontSize: 10, color: TEXT_MID, fontFace: 'Calibri',
    });
  });
}

function addCompanySlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addHeader(slide, pptx, '01 · Company Overview');
  addFooter(slide, pptx);

  slide.addText('Company Overview & ABC Permit Status', {
    x: 0.5, y: 0.35, w: 9, h: 0.55,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 2.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const leftItems = [
    { label: 'Company Name', val: 'Alcohol Delivered, LLC' },
    { label: 'Headquarters', val: 'Pine Bluff, Arkansas' },
    { label: 'Service Area', val: 'Wet counties in Southeast Arkansas' },
    { label: 'ABC Permit Type', val: 'Third-Party Delivery Permit (ACT 157)' },
    { label: 'Permit Renewal', val: 'Annual — $500 filing fee' },
    { label: 'Permit Authority', val: 'Arkansas ABC Division, Little Rock, AR' },
  ];

  leftItems.forEach((item, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 1.15 + i * 0.58, w: 5.4, h: 0.5,
      fill: { color: i % 2 === 0 ? 'f8fafc' : WHITE }, line: { color: 'e2e8f0', pt: 1 },
    });
    slide.addText(item.label, {
      x: 0.6, y: 1.18 + i * 0.58, w: 2.0, h: 0.44,
      fontSize: 11, color: '6b7280', fontFace: 'Calibri',
    });
    slide.addText(item.val, {
      x: 2.7, y: 1.18 + i * 0.58, w: 3.0, h: 0.44,
      fontSize: 11, bold: true, color: TEXT_DARK, fontFace: 'Calibri',
    });
  });

  // Right panel — compliance statement
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.0, y: 1.15, w: 3.6, h: 3.7,
    fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });
  slide.addText('Our Commitment', {
    x: 6.15, y: 1.3, w: 3.3, h: 0.45,
    fontSize: 15, bold: true, color: BRAND_GOLD, fontFace: 'Calibri',
  });
  slide.addText(
    'Alcohol Delivered operates in full compliance with Arkansas ACT 157 (2025). We hold a valid ABC Third-Party Delivery Permit and require every driver to complete our comprehensive training and approval program before making a single delivery.\n\nWe maintain complete electronic records of driver eligibility, training completion, background checks, and delivery logs — all available for ABC audit upon request.',
    {
      x: 6.15, y: 1.85, w: 3.3, h: 2.8,
      fontSize: 10.5, color: 'cbd5e1', fontFace: 'Calibri', valign: 'top', breakLine: true, lineSpacingMultiple: 1.4,
    }
  );
}

function addEligibilitySlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addHeader(slide, pptx, '02 · Driver Eligibility Requirements');
  addFooter(slide, pptx);

  slide.addText('Driver Eligibility Requirements', {
    x: 0.5, y: 0.35, w: 9, h: 0.55,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addText('Per Arkansas ACT 157 §3-4-1101(d)', {
    x: 0.5, y: 0.92, w: 9, h: 0.3,
    fontSize: 12, color: BRAND_GOLD, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.22, w: 2.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const required = [
    { icon: '✓', text: 'Must be 21 years of age or older', detail: 'Verified via government-issued photo ID at onboarding' },
    { icon: '✓', text: 'Must hold a valid driver\'s license', detail: 'Verified at signup; license must be current and not suspended' },
    { icon: '✓', text: 'No felony convictions — no exceptions', detail: 'Confirmed via third-party background check (Checkr); permanent disqualifier' },
    { icon: '✓', text: 'Must complete ABC-approved training', detail: 'All 5 training modules + quiz must be passed before first delivery' },
  ];

  required.forEach((r, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 1.38 + i * 0.88, w: 5.6, h: 0.78,
      fill: { color: 'f0fdf4' }, line: { color: 'bbf7d0', pt: 1.5 },
    });
    slide.addText(r.icon, {
      x: 0.55, y: 1.41 + i * 0.88, w: 0.4, h: 0.35,
      fontSize: 16, color: GREEN, fontFace: 'Calibri', bold: true,
    });
    slide.addText(r.text, {
      x: 1.0, y: 1.41 + i * 0.88, w: 4.8, h: 0.32,
      fontSize: 12, bold: true, color: TEXT_DARK, fontFace: 'Calibri',
    });
    slide.addText(r.detail, {
      x: 1.0, y: 1.73 + i * 0.88, w: 4.8, h: 0.32,
      fontSize: 10, color: TEXT_MID, fontFace: 'Calibri',
    });
  });

  // Disqualifiers panel
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.2, y: 1.38, w: 3.4, h: 3.52,
    fill: { color: 'fff1f2' }, line: { color: 'fecaca', pt: 1.5 },
  });
  slide.addText('Automatic Disqualifiers', {
    x: 6.35, y: 1.5, w: 3.1, h: 0.4,
    fontSize: 13, bold: true, color: RED, fontFace: 'Calibri',
  });
  const disqualifiers = [
    'Any felony conviction (no exceptions)',
    'Under 21 years of age',
    'Expired or suspended driver\'s license',
    'Failed or incomplete training',
    'Delivery to dry county or address',
    'Prior ABC violation on record',
  ];
  disqualifiers.forEach((d, i) => {
    slide.addText(`✗  ${d}`, {
      x: 6.35, y: 2.0 + i * 0.43, w: 3.1, h: 0.38,
      fontSize: 10, color: RED, fontFace: 'Calibri',
    });
  });
}

function addScreeningSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addHeader(slide, pptx, '03 · Application & Screening Process');
  addFooter(slide, pptx);

  slide.addText('Driver Application & Screening Process', {
    x: 0.5, y: 0.35, w: 9, h: 0.55,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 2.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const steps = [
    { step: '1', title: 'Online Application', detail: 'Driver submits name, DOB, contact info, driver\'s license, vehicle details, and prior gig experience via the Alcohol Delivered platform.' },
    { step: '2', title: 'Age & License Verification', detail: 'System confirms applicant is 21+. License number is recorded and validated. Applicants under 21 are automatically rejected.' },
    { step: '3', title: 'Background Check (Checkr)', detail: 'Third-party background check initiated via Checkr. Any felony conviction in the record results in immediate, permanent disqualification per ACT 157.' },
    { step: '4', title: 'Training Program Enrollment', detail: 'Upon passing screening, driver is enrolled in the 5-module ABC-compliant training program within the platform.' },
    { step: '5', title: 'Training Completion & Quiz', detail: 'Driver must complete all 5 modules and pass each knowledge-check quiz. Scores are logged electronically with timestamp.' },
    { step: '6', title: 'Driver Agreement Signing', detail: 'Driver electronically signs the Alcohol Delivered Driver Agreement acknowledging ACT 157 obligations and ABC regulations.' },
    { step: '7', title: 'Admin Approval & Activation', detail: 'Admin reviews completed application and training record. Upon approval, driver account is activated. Status is set to "Available" in the dispatch system.' },
  ];

  steps.forEach((s, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i < 4 ? i : i - 4;
    const x = col === 0 ? 0.4 : 5.1;
    const y = 1.12 + row * 0.97;

    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 4.5, h: 0.85,
      fill: { color: col === 0 ? 'f8fafc' : 'fefce8' }, line: { color: 'e2e8f0', pt: 1 },
    });
    slide.addShape(pptx.ShapeType.ellipse, {
      x: x + 0.12, y: y + 0.2, w: 0.45, h: 0.45,
      fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
    });
    slide.addText(s.step, {
      x: x + 0.12, y: y + 0.19, w: 0.45, h: 0.45,
      fontSize: 11, bold: true, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
    });
    slide.addText(s.title, {
      x: x + 0.7, y: y + 0.06, w: 3.65, h: 0.32,
      fontSize: 11, bold: true, color: TEXT_DARK, fontFace: 'Calibri',
    });
    slide.addText(s.detail, {
      x: x + 0.7, y: y + 0.38, w: 3.65, h: 0.42,
      fontSize: 9.5, color: TEXT_MID, fontFace: 'Calibri', breakLine: true,
    });
  });

  // Step 7 spans col 1 row 3 — already positioned correctly above
}

function addCurriculumSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addHeader(slide, pptx, '04 · Training Curriculum');
  addFooter(slide, pptx);

  slide.addText('Training Curriculum — 5 Modules', {
    x: 0.5, y: 0.35, w: 9, h: 0.55,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addText('All modules must be completed before a driver makes their first delivery', {
    x: 0.5, y: 0.92, w: 9, h: 0.3,
    fontSize: 11, color: TEXT_MID, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.22, w: 3.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const modules = [
    { num: 'M1', title: 'Arkansas Alcohol Laws', topics: 'Legal drinking age (21), legal hours (7am–2am), wet/dry county rules, ACT 157 delivery requirements', lessons: '4 lessons + 3 quiz questions' },
    { num: 'M2', title: 'Responsible Consumption', topics: 'Standard drink sizes, BAC limits (0.08%), signs of overconsumption, alcohol & medications', lessons: '4 lessons + 3 quiz questions' },
    { num: 'M3', title: 'ID Verification & Your Rights', topics: 'Why we verify ID, accepted ID types, delivery handoff procedure, data privacy', lessons: '4 lessons + 3 quiz questions' },
    { num: 'M4', title: 'Arkansas ACT 157 — Delivery Law', topics: 'Statutory overview, driver eligibility, geographic restrictions, authorized recipients', lessons: '4 lessons + 3 quiz questions' },
    { num: 'M5', title: 'Community Safety', topics: 'Furnishing alcohol to minors, responsible hosting, recognizing abuse, refusal protocol', lessons: '4 lessons + 3 quiz questions' },
  ];

  modules.forEach((m, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 1.38 + i * 0.72, w: 9.2, h: 0.65,
      fill: { color: i % 2 === 0 ? 'f8fafc' : WHITE }, line: { color: 'e2e8f0', pt: 1 },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 1.38 + i * 0.72, w: 0.55, h: 0.65,
      fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
    });
    slide.addText(m.num, {
      x: 0.4, y: 1.41 + i * 0.72, w: 0.55, h: 0.58,
      fontSize: 11, bold: true, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
    });
    slide.addText(m.title, {
      x: 1.08, y: 1.41 + i * 0.72, w: 2.8, h: 0.3,
      fontSize: 11, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
    });
    slide.addText(m.lessons, {
      x: 1.08, y: 1.71 + i * 0.72, w: 2.8, h: 0.26,
      fontSize: 9, color: BRAND_GOLD, fontFace: 'Calibri',
    });
    slide.addText(m.topics, {
      x: 4.0, y: 1.42 + i * 0.72, w: 5.5, h: 0.56,
      fontSize: 10, color: TEXT_MID, fontFace: 'Calibri', breakLine: true,
    });
  });
}

function addCertificationSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addHeader(slide, pptx, '05 · Certification & Record-Keeping');
  addFooter(slide, pptx);

  slide.addText('Training Completion & Certification', {
    x: 0.5, y: 0.35, w: 9, h: 0.55,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 3.0, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const leftItems = [
    { title: 'Digital Training Certificate', body: 'Upon completing all 5 modules and quizzes, a dated digital training certificate is generated within the platform, permanently linked to the driver\'s profile.' },
    { title: 'Timestamped Completion Records', body: 'Each module completion is logged with a precise timestamp and stored in our database. Records are available for ABC audit upon request, no notice required.' },
    { title: 'Quiz Passing Standard', body: 'Drivers must correctly answer all quiz questions in each module before proceeding. Incorrect answers require the driver to re-study the slide before retrying.' },
    { title: 'Admin Approval Gate', body: 'Training completion alone does not activate a driver account. A platform administrator must review and explicitly approve the driver before first delivery dispatch.' },
  ];

  leftItems.forEach((item, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 1.12 + i * 0.95, w: 5.5, h: 0.85,
      fill: { color: i % 2 === 0 ? 'f0fdf4' : 'f8fafc' }, line: { color: i % 2 === 0 ? 'bbf7d0' : 'e2e8f0', pt: 1 },
    });
    slide.addText(item.title, {
      x: 0.6, y: 1.15 + i * 0.95, w: 5.2, h: 0.3,
      fontSize: 11, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
    });
    slide.addText(item.body, {
      x: 0.6, y: 1.45 + i * 0.95, w: 5.2, h: 0.48,
      fontSize: 10, color: TEXT_MID, fontFace: 'Calibri', breakLine: true,
    });
  });

  // Right panel — record availability
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.1, y: 1.12, w: 3.5, h: 3.7,
    fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });
  slide.addText('Records Available\nfor ABC Audit', {
    x: 6.25, y: 1.28, w: 3.2, h: 0.75,
    fontSize: 14, bold: true, color: BRAND_GOLD, fontFace: 'Calibri',
  });
  const records = [
    'Driver full name & DOB',
    'License number & state',
    'Background check result & date',
    'Training completion date',
    'Quiz scores per module',
    'Digital certificate (PDF)',
    'Driver Agreement signature',
    'First delivery date',
    'Delivery history log',
  ];
  records.forEach((r, i) => {
    slide.addText(`✓  ${r}`, {
      x: 6.25, y: 2.1 + i * 0.3, w: 3.2, h: 0.28,
      fontSize: 9.5, color: i < 3 ? BRAND_GOLD : 'cbd5e1', fontFace: 'Calibri',
    });
  });
}

const TRAINING_MODULES = [
  {
    title: 'Arkansas Alcohol Laws',
    slides: [
      { heading: 'Legal Drinking Age', body: 'The legal drinking age in Arkansas is 21. It is illegal to purchase, possess, or consume alcohol if you are under 21 years of age. Attempting to purchase alcohol with a false ID is a criminal offense.' },
      { heading: 'Legal Hours', body: 'Alcohol sales in Arkansas are permitted between 7:00 AM and 2:00 AM. Deliveries may only occur during legally permitted hours in your county. Wet/dry county laws apply — some counties and cities have additional restrictions.' },
      { heading: 'Wet vs. Dry Counties', body: 'Arkansas has both wet and dry counties. Alcohol delivery is only available in wet jurisdictions where local law permits alcohol sales. Our system automatically verifies your delivery address is within a legal zone before completing your order.' },
      { heading: 'Delivery Rules Under ACT 157', body: 'Under Arkansas ACT 157 (2025), alcohol may only be delivered to: (1) the person who placed the order if they are 21+, or (2) another household or workplace member who is 21+. The recipient must present valid proof of identity and age. No unattended deliveries are permitted.' },
    ],
  },
  {
    title: 'Responsible Consumption',
    slides: [
      { heading: 'Know Your Limits', body: 'A standard drink contains 14g of pure alcohol — roughly 12oz of regular beer (5%), 5oz of wine (12%), or 1.5oz of spirits (40%). The liver processes about one standard drink per hour.' },
      { heading: 'Blood Alcohol Content (BAC)', body: 'Arkansas DWI law sets the legal BAC limit at 0.08% for drivers. At 0.05% BAC, judgment and coordination are already impaired. If you drink, do NOT drive.' },
      { heading: 'Signs of Overconsumption', body: 'Warning signs include slurred speech, impaired coordination, confusion, vomiting, unconsciousness, and slow or irregular breathing. Alcohol poisoning is a medical emergency — call 911 immediately.' },
      { heading: 'Alcohol & Medications', body: 'Alcohol can interact dangerously with many medications including pain relievers, sleep aids, anxiety medications, and antibiotics. Always consult your doctor or pharmacist.' },
    ],
  },
  {
    title: 'ID Verification & Your Rights',
    slides: [
      { heading: 'Why We Verify ID', body: 'Arkansas law requires that alcohol retailers verify the age of all purchasers. As a third-party delivery platform, we are required to verify ID both at checkout (online) and at the point of delivery.' },
      { heading: 'Accepted Forms of ID', body: 'We accept: Arkansas Driver\'s License, State-issued ID card, US Passport or Passport Card, US Military ID. All IDs must be government-issued, current, and not expired.' },
      { heading: 'What Happens at Delivery', body: 'Our driver will ask to see ID before handing over the order. They will check name, photo, and date of birth. The ID must match the person who placed the order. If ID is not presented, the delivery will be refused.' },
      { heading: 'Your Privacy', body: 'ID images are encrypted and stored securely solely for compliance and audit purposes. We do not share your ID data with third parties.' },
    ],
  },
  {
    title: 'Arkansas ACT 157 — Delivery Law',
    slides: [
      { heading: 'What is ACT 157?', body: 'Arkansas ACT 157 (2025), codified at A.C.A. §3-4-107 and §3-4-1101–§3-4-1106, authorizes third-party delivery services to legally deliver alcohol. The company must hold an ABC Third-Party Delivery Permit ($500/year).' },
      { heading: 'Driver Eligibility Requirements', body: 'Under ACT 157 §3-4-1101(d), every delivery driver must: (1) be 21 years of age or older, (2) hold a valid driver\'s license, and (3) have NO felony convictions on their record — with no exceptions or timeframe windows.' },
      { heading: 'Where Can You Deliver?', body: 'ACT 157 §3-4-1102 restricts deliveries to wet areas only. You may deliver within the county where the retailer is located (if wet), or an adjoining wet county. Deliveries to dry counties are strictly prohibited.' },
      { heading: 'Who Can Receive the Delivery?', body: 'Per ACT 157 §3-4-1103, you may only deliver to: (1) the person who placed the order, if 21+, or (2) another person at the household or place of employment who is 21+. Valid ID must be verified before handoff.' },
    ],
  },
  {
    title: 'Community Safety',
    slides: [
      { heading: 'Never Buy for Minors', body: 'Purchasing alcohol for someone under 21 is "furnishing alcohol to a minor" in Arkansas — a serious criminal offense with fines, jail time, and permanent criminal record. This applies even for family members.' },
      { heading: 'Hosting Responsibly', body: 'If you host gatherings where alcohol is served, ensure non-alcoholic beverages are available, monitor guests\' consumption, and never allow an impaired person to drive. You are legally and morally responsible.' },
      { heading: 'Recognizing Alcohol Abuse', body: 'Signs of alcohol dependency: drinking alone or secretly, neglecting responsibilities, increased tolerance, withdrawal symptoms, inability to stop. Arkansas Substance Abuse Helpline: 1-800-482-9135.' },
      { heading: 'Our Community Commitment', body: 'Alcohol Delivered refuses service to visibly intoxicated customers, trains all drivers in responsible delivery practices, and cooperates fully with Arkansas ABC enforcement activities.' },
    ],
  },
];

function addTrainingContentSlides(pptx) {
  TRAINING_MODULES.forEach((mod, modIdx) => {
    // Section header slide for this module
    const headerSlide = pptx.addSlide();
    headerSlide.background = { color: BRAND_DARK };
    headerSlide.addText(`Module ${modIdx + 1} of 5`, {
      x: 0.5, y: 1.2, w: 9, h: 0.4,
      fontSize: 15, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
    });
    headerSlide.addText(mod.title, {
      x: 0.5, y: 1.75, w: 9, h: 0.75,
      fontSize: 30, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
    });
    headerSlide.addShape(pptx.ShapeType.rect, {
      x: 3.5, y: 2.65, w: 3, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
    });
    headerSlide.addText(`${mod.slides.length} lessons  ·  Training Section 06`, {
      x: 0.5, y: 2.85, w: 9, h: 0.35,
      fontSize: 12, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
    });
    headerSlide.addText('Alcohol Delivered, LLC  ·  Pine Bluff, AR  ·  Arkansas ABC Third-Party Delivery Permit Holder', {
      x: 0.5, y: 5.1, w: 9, h: 0.22,
      fontSize: 8, color: '475569', align: 'center', fontFace: 'Calibri',
    });

    // One content slide per lesson
    mod.slides.forEach((s, sIdx) => {
      const slide = pptx.addSlide();
      slide.background = { color: WHITE };
      addHeader(slide, pptx, `06 · Training — ${mod.title}`);
      addFooter(slide, pptx);

      // Slide counter pill
      slide.addText(`${sIdx + 1} / ${mod.slides.length}`, {
        x: 8.5, y: 0.27, w: 1.1, h: 0.28,
        fontSize: 9, color: '94a3b8', fontFace: 'Calibri', align: 'right',
      });

      // Module tag
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.4, y: 0.32, w: 0.06, h: 0.9,
        fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
      });

      slide.addText(`M${modIdx + 1}  ·  ${mod.title}`, {
        x: 0.6, y: 0.32, w: 7.5, h: 0.3,
        fontSize: 10, color: BRAND_GOLD, bold: true, fontFace: 'Calibri',
      });

      slide.addText(s.heading, {
        x: 0.6, y: 0.64, w: 9.0, h: 0.6,
        fontSize: 24, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
      });

      slide.addShape(pptx.ShapeType.rect, {
        x: 0.6, y: 1.28, w: 1.4, h: 0.06,
        fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
      });

      slide.addText(s.body, {
        x: 0.6, y: 1.45, w: 8.8, h: 3.4,
        fontSize: 15, color: TEXT_MID, fontFace: 'Calibri',
        valign: 'top', breakLine: true, lineSpacingMultiple: 1.5,
      });
    });
  });
}

function addClosingSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addText('Summary', {
    x: 0.5, y: 0.7, w: 9, h: 0.55,
    fontSize: 28, bold: true, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 1.35, w: 3, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const points = [
    'Every driver is 21+, licensed, and felony-free — verified before activation',
    '7-step screening and approval process before first delivery',
    '5-module ABC-compliant training with mandatory quiz completion',
    'Digital certificates and timestamped records maintained indefinitely',
    'GPS zone enforcement — deliveries restricted to wet areas only',
    'Admin approval gate separates training completion from activation',
    'All records available to ABC Division upon request',
  ];

  points.forEach((p, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.0, y: 1.55 + i * 0.47, w: 0.32, h: 0.32,
      fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
    });
    slide.addText('✓', {
      x: 1.0, y: 1.56 + i * 0.47, w: 0.32, h: 0.3,
      fontSize: 11, color: BRAND_DARK, align: 'center', bold: true, fontFace: 'Calibri',
    });
    slide.addText(p, {
      x: 1.45, y: 1.57 + i * 0.47, w: 7.5, h: 0.38,
      fontSize: 12, color: i < 2 ? BRAND_GOLD : 'cbd5e1', fontFace: 'Calibri',
    });
  });

  slide.addText('Alcohol Delivered, LLC  ·  Pine Bluff, AR  ·  alcohol.delivered1@gmail.com', {
    x: 0.5, y: 4.9, w: 9, h: 0.3,
    fontSize: 10, color: '475569', align: 'center', fontFace: 'Calibri',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response, user } = await assertAdmin(base44);
    if (!authorized) return response;

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Alcohol Delivered, LLC';
    pptx.company = 'Alcohol Delivered, LLC';
    pptx.subject = 'Driver Training & Approval Process — Arkansas ABC';
    pptx.title = 'Driver Training & Approval Process';

    addTitleSlide(pptx);
    addOverviewSlide(pptx);
    addCompanySlide(pptx);
    addEligibilitySlide(pptx);
    addScreeningSlide(pptx);
    addCurriculumSlide(pptx);
    addCertificationSlide(pptx);
    addTrainingContentSlides(pptx);
    addClosingSlide(pptx);

    const base64 = await pptx.write({ outputType: 'base64' });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const file = new File([blob], 'AlcoholDelivered_DriverApprovalProcess_ABC.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    console.log('Driver Approval PPTX generated:', file_url);
    return Response.json({ success: true, download_url: file_url });

  } catch (error) {
    console.error('generateDriverApprovalPPTX error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});