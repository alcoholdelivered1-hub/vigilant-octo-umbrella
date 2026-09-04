import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import PptxGenJS from 'npm:pptxgenjs@3.12.0';

const BRAND_DARK = '1e3a5f';
const BRAND_GOLD = 'f59e0b';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'f1f5f9';
const TEXT_DARK = '1e293b';
const TEXT_MID = '475569';

const MODULES = [
  {
    title: 'Arkansas Alcohol Laws — Your Role as a Driver',
    icon: '⚖️',
    imagePrompts: [
      'A delivery driver in uniform standing in front of a liquor store in Arkansas reviewing a checklist on a phone, daytime, photorealistic',
      'A close-up of a delivery driver\'s hand holding a sealed paper bag with a receipt, professional photo',
      'A delivery driver looking at a GPS map on a phone showing a route within a highlighted wet county, photorealistic',
      'A delivery driver in uniform knocking on a front door holding a sealed delivery bag, daytime, photorealistic',
    ],
    slides: [
      { heading: 'Your Legal Responsibilities', body: 'As a delivery driver, YOU are the final checkpoint. You must be 21+, hold a valid driver\'s license, and have no felony convictions. You are personally responsible for verifying age and refusing illegal deliveries.' },
      { heading: 'Legal Delivery Hours', body: 'You may only deliver alcohol between 7:00 AM and 2:00 AM. Never deliver outside these hours, even if the app allows it. Wet/dry county restrictions apply — check the app for zone status before every delivery.' },
      { heading: 'Wet vs. Dry Counties', body: 'You may only deliver in wet counties — within the same county as the retailer, or an adjoining wet county. The app verifies the zone, but you must confirm the destination address makes sense. If something looks wrong, contact dispatch.' },
      { heading: 'Unattended Deliveries Are Illegal', body: 'Under ACT 157, you may NEVER leave alcohol unattended at a door, porch, or mailbox. You must hand the order directly to a verified 21+ recipient. No exceptions — even if the customer asks you to.' },
    ],
    quiz: [
      { q: 'As a driver, what must you do before handing over alcohol?', opts: ['Leave it at the door', 'Verify the recipient\'s ID and age', 'Call the customer', 'Just check the address'], correct: 1 },
      { q: 'Until what time can you legally deliver alcohol?', opts: ['10:00 PM', '12:00 AM', '2:00 AM', '4:00 AM'], correct: 2 },
      { q: 'Can you leave alcohol unattended if the customer asks?', opts: ['Yes, with a note', 'Yes, if they paid extra', 'No, never', 'Only for small orders'], correct: 2 },
    ],
  },
  {
    title: 'Refusing Delivery — Intoxicated Customers',
    icon: '🧠',
    imagePrompts: [
      'A delivery driver politely refusing to hand a bag to a visibly intoxicated person at a front door, professional, photorealistic',
      'A delivery driver documenting a refused delivery on their smartphone app, close-up, photorealistic',
      'A delivery driver calling dispatch on a phone while sitting in a parked car, professional, photorealistic',
      'A delivery driver returning a sealed bag to their vehicle after a refused delivery, daytime, photorealistic',
    ],
    slides: [
      { heading: 'When to Refuse Delivery', body: 'You MUST refuse delivery if the recipient: (1) is visibly intoxicated, (2) cannot produce valid ID, (3) appears to be under 21, or (4) is not the purchaser or a 21+ household member. Refusal is your legal duty, not a choice.' },
      { heading: 'Spotting Intoxication', body: 'Look for: slurred speech, stumbling or unsteady gait, glassy or bloodshot eyes, aggressive behavior, alcohol on the breath. If in doubt, refuse. You will not be penalized for a good-faith refusal.' },
      { heading: 'How to Refuse Professionally', body: 'Stay calm and polite. Say: "I\'m sorry, I cannot complete this delivery." Do not argue. Log the refusal in the app with the reason. Return the order to the store. Contact dispatch if the customer becomes hostile.' },
      { heading: 'Handling Difficult Situations', body: 'If a customer becomes aggressive, do not engage. Return to your vehicle, lock the doors, and call dispatch or 911 if you feel unsafe. Never argue or physically intervene. Your safety comes first.' },
    ],
    quiz: [
      { q: 'If a customer appears intoxicated, what should you do?', opts: ['Deliver anyway', 'Deliver but warn them', 'Refuse the delivery', 'Charge extra'], correct: 2 },
      { q: 'Will you be penalized for a good-faith refusal?', opts: ['Yes', 'No', 'Only after 3 refusals', 'Only on weekends'], correct: 1 },
      { q: 'If a customer becomes hostile, what is your first step?', opts: ['Argue back', 'Call dispatch or 911 from your vehicle', 'Deliver to avoid conflict', 'Physically restrain them'], correct: 1 },
    ],
  },
  {
    title: 'ID Verification at the Door',
    icon: '🪪',
    imagePrompts: [
      'A delivery driver in uniform scanning a customer\'s ID with a smartphone app at a front door, close-up, photorealistic',
      'A delivery driver carefully examining a driver\'s license under good lighting, holding it next to the customer, photorealistic',
      'A close-up of a vertical (under 21) driver\'s license being held by a delivery driver, photorealistic',
      'A delivery driver logging ID verification results in their delivery app, close-up on phone screen, photorealistic',
    ],
    slides: [
      { heading: 'Your ID Check Procedure', body: 'Before handing over the order: (1) Ask for ID, (2) Check it is government-issued and unexpired, (3) Verify the photo matches the person, (4) Confirm the date of birth shows 21+, (5) Check for vertical (under 21) IDs. If any step fails, refuse.' },
      { heading: 'Accepted Forms of ID', body: 'Accept: Arkansas Driver\'s License, State-issued ID card, US Passport or Passport Card, US Military ID. Do NOT accept: school IDs, expired IDs, vertical/minor IDs, or photocopies/photos on a phone.' },
      { heading: 'Spotting Fake IDs', body: 'Check for: misspelled words, uneven lamination, missing holograms, altered dates, or IDs that feel flimsy. Compare the photo carefully. If you suspect a fake ID, refuse the delivery and log it. You are not required to confiscate the ID.' },
      { heading: 'Who Can Receive the Order', body: 'You may deliver to: (1) the person who placed the order (if 21+), or (2) another person at the same household or workplace who is 21+. You must verify their ID regardless. Never deliver to a minor or someone who cannot prove their age.' },
    ],
    quiz: [
      { q: 'Which ID should you NOT accept?', opts: ['AR Driver\'s License', 'US Passport', 'School ID', 'US Military ID'], correct: 2 },
      { q: 'What does a vertical driver\'s license typically indicate?', opts: ['Over 21', 'Under 21', 'Commercial driver', 'Temporary visitor'], correct: 1 },
      { q: 'If you suspect a fake ID, what should you do?', opts: ['Deliver anyway', 'Confiscate the ID', 'Refuse and log it', 'Call the police immediately'], correct: 2 },
    ],
  },
  {
    title: 'ACT 157 — Your Legal Requirements',
    icon: '📜',
    imagePrompts: [
      'A delivery driver in uniform standing next to their vehicle holding their driver\'s license, clean background, photorealistic',
      'A delivery driver securing sealed alcohol bags in the trunk of a clean vehicle, daytime, photorealistic',
      'A delivery driver reviewing delivery route and zone information on their phone, sitting in the driver\'s seat, photorealistic',
      'A delivery driver completing a delivery handoff to an adult who shows their ID at a doorstep, photorealistic',
    ],
    slides: [
      { heading: 'Your Personal Eligibility', body: 'Under ACT 157 §3-4-1101(d), you MUST be: (1) 21 years or older, (2) hold a valid driver\'s license, and (3) have NO felony convictions — ever, with no exceptions. Falsifying this is a criminal offense.' },
      { heading: 'Where You Can Deliver', body: 'You may deliver within the county where the retailer is located (if wet), or an adjoining wet county. Deliveries to dry counties are strictly prohibited. The app blocks illegal zones, but you must use judgment if the destination seems wrong.' },
      { heading: 'Securing the Order in Transit', body: 'Keep all alcohol in sealed packaging from the retailer. Store it in your trunk or behind the last row of seats — never in the driver area. No open containers in your vehicle at any time, ever.' },
      { heading: 'Your Personal Liability', body: 'As the driver, YOU are responsible for delivery compliance. If you deliver to a minor or an intoxicated person, YOU face fines, criminal charges, and loss of your job. The retailer is NOT liable for your violations. Take every delivery seriously.' },
    ],
    quiz: [
      { q: 'Under ACT 157, can a driver with a 10-year-old felony conviction deliver alcohol?', opts: ['Yes, it was long ago', 'No — no felony convictions, ever', 'Yes, with a waiver', 'Only non-violent felonies'], correct: 1 },
      { q: 'Where should alcohol be stored in your vehicle?', opts: ['In the passenger seat', 'In your lap', 'Trunk or behind last row of seats', 'In the cupholder'], correct: 2 },
      { q: 'Who is personally liable if you deliver to a minor?', opts: ['The retailer', 'The customer', 'You, the driver', 'The app company'], correct: 2 },
    ],
  },
  {
    title: 'Refusing Service & Handling Minors',
    icon: '🤝',
    imagePrompts: [
      'A delivery driver firmly but politely refusing to hand a bag to a young-looking person at a door, holding up a hand, photorealistic',
      'A delivery driver logging a refusal reason in their delivery app, close-up on phone screen, photorealistic',
      'A delivery driver returning to their vehicle with an undelivered order, daytime, photorealistic',
      'A delivery driver speaking with dispatch on the phone while parked, professional, photorealistic',
    ],
    slides: [
      { heading: 'Never Deliver to a Minor', body: 'Delivering alcohol to someone under 21 is "furnishing alcohol to a minor" — a serious criminal offense in Arkansas. Even if an adult at the door says "it\'s for my kid," refuse. No exceptions, no excuses.' },
      { heading: 'Third-Party Purchases', body: 'If someone other than the purchaser tries to receive the order, they must still be 21+ and present valid ID. If a minor answers the door, do not hand over the order. Ask for the person who placed the order or another 21+ adult.' },
      { heading: 'Documenting Refusals', body: 'Every refusal must be logged in the app with: the reason (intoxicated, minor, no ID, wrong person), the time, and the address. This protects you legally and provides an audit trail for ABC compliance.' },
      { heading: 'Returning Undelivered Orders', body: 'If you refuse a delivery, return the sealed order to the retailer. Do not consume, keep, or resell any undelivered alcohol. Log the return in the app. You will still be paid for the attempted delivery.' },
    ],
    quiz: [
      { q: 'If an adult says the alcohol is for their underage child, what do you do?', opts: ['Deliver it', 'Refuse', 'Deliver and log it', 'Charge double'], correct: 1 },
      { q: 'What must you do after every refused delivery?', opts: ['Nothing', 'Log it in the app with the reason', 'Call the police', 'Throw away the order'], correct: 1 },
      { q: 'What should you do with an undelivered alcohol order?', opts: ['Keep it', 'Consume it', 'Return it sealed to the retailer', 'Resell it'], correct: 2 },
    ],
  },
];

// Fetch a URL and return base64 data URI
async function urlToBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function addTitleSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addText('ALCOHOL DELIVERED', {
    x: 0.5, y: 1.2, w: 9, h: 0.7,
    fontSize: 36, bold: true, color: BRAND_GOLD,
    align: 'center', fontFace: 'Calibri',
  });
  slide.addText('Delivery Driver Training & ABC Compliance', {
    x: 0.5, y: 2.0, w: 9, h: 0.5,
    fontSize: 22, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('Arkansas ACT 157 (2025) Certified Program', {
    x: 0.5, y: 2.7, w: 9, h: 0.4,
    fontSize: 14, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 3.3, w: 3, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText([
    { text: 'Pine Bluff, Arkansas  ·  ', options: { color: 'aab4c4' } },
    { text: 'ABC-Approved Training', options: { color: BRAND_GOLD } },
  ], { x: 0.5, y: 3.7, w: 9, h: 0.4, fontSize: 13, align: 'center', fontFace: 'Calibri' });
  slide.addText(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, {
    x: 0.5, y: 4.2, w: 9, h: 0.3,
    fontSize: 11, color: '6b7280', align: 'center', fontFace: 'Calibri',
  });
}

function addAgendaSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT_GRAY };

  slide.addText('Training Agenda', {
    x: 0.5, y: 0.3, w: 9, h: 0.6,
    fontSize: 28, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 0.95, w: 9, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const items = MODULES.map((m, i) => `${i + 1}.  ${m.title}`);
  items.forEach((item, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.2 + i * 0.65, w: 9, h: 0.55,
      fill: { color: WHITE }, line: { color: 'e2e8f0', pt: 1 },
    });
    slide.addText(item, {
      x: 0.7, y: 1.25 + i * 0.65, w: 8.6, h: 0.45,
      fontSize: 14, color: TEXT_DARK, fontFace: 'Calibri', bold: i === 3,
    });
  });
}

function addSectionHeaderSlide(pptx, module, moduleNum) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addText(`Module ${moduleNum}`, {
    x: 0.5, y: 1.3, w: 9, h: 0.4,
    fontSize: 16, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
  });
  slide.addText(module.title, {
    x: 0.5, y: 1.8, w: 9, h: 0.8,
    fontSize: 30, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 2.8, w: 3, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText(`${module.slides.length} lessons  ·  ${module.quiz.length} quiz questions`, {
    x: 0.5, y: 3.1, w: 9, h: 0.4,
    fontSize: 13, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
  });
}

function addContentSlideWithImage(pptx, heading, body, moduleTitle, slideNum, totalSlides, imageBase64) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  // Top accent bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.18, fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });

  // Module label + slide count
  slide.addText(moduleTitle.toUpperCase(), {
    x: 0.4, y: 0.22, w: 7, h: 0.3,
    fontSize: 9, color: BRAND_GOLD, bold: true, fontFace: 'Calibri',
  });
  slide.addText(`${slideNum} / ${totalSlides}`, {
    x: 8.5, y: 0.22, w: 1, h: 0.3,
    fontSize: 9, color: '94a3b8', fontFace: 'Calibri', align: 'right',
  });

  // Left column: heading + body text
  slide.addText(heading, {
    x: 0.4, y: 0.65, w: 5.6, h: 0.6,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 1.3, w: 1.2, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText(body, {
    x: 0.4, y: 1.48, w: 5.6, h: 3.2,
    fontSize: 14, color: TEXT_MID, fontFace: 'Calibri', valign: 'top',
    breakLine: true, lineSpacingMultiple: 1.4,
  });

  // Right column: AI-generated image
  if (imageBase64) {
    slide.addImage({
      data: `image/jpeg;base64,${imageBase64}`,
      x: 6.2, y: 0.55, w: 3.5, h: 4.2,
    });
    // Subtle border around image
    slide.addShape(pptx.ShapeType.rect, {
      x: 6.2, y: 0.55, w: 3.5, h: 4.2,
      fill: { type: 'none' }, line: { color: 'e2e8f0', pt: 1 },
    });
  }

  // Bottom bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 5.1, w: 10, h: 0.27, fill: { color: LIGHT_GRAY }, line: { color: LIGHT_GRAY },
  });
  slide.addText('Alcohol Delivered  ·  ABC Driver Training  ·  Arkansas ACT 157 (2025)', {
    x: 0.4, y: 5.13, w: 9.2, h: 0.2,
    fontSize: 8, color: '94a3b8', fontFace: 'Calibri',
  });
}

function addQuizSlide(pptx, moduleTitle, quizItems) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.18, fill: { color: BRAND_DARK }, line: { color: BRAND_DARK },
  });
  slide.addText(moduleTitle.toUpperCase() + '  ·  KNOWLEDGE CHECK', {
    x: 0.4, y: 0.22, w: 9.2, h: 0.3,
    fontSize: 9, color: BRAND_GOLD, bold: true, fontFace: 'Calibri',
  });
  slide.addText('Knowledge Check', {
    x: 0.5, y: 0.6, w: 9, h: 0.55,
    fontSize: 22, bold: true, color: BRAND_DARK, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.2, w: 1.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const startY = 1.35;
  const rowH = 1.15;
  quizItems.forEach((item, i) => {
    const y = startY + i * rowH;
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y, w: 9.2, h: rowH - 0.08,
      fill: { color: i % 2 === 0 ? 'f8fafc' : WHITE }, line: { color: 'e2e8f0', pt: 1 },
    });
    slide.addText(`Q${i + 1}.  ${item.q}`, {
      x: 0.6, y: y + 0.05, w: 8.8, h: 0.32,
      fontSize: 12, bold: true, color: TEXT_DARK, fontFace: 'Calibri',
    });
    const correct = item.opts[item.correct];
    const others = item.opts.filter((_, idx) => idx !== item.correct).join('   |   ');
    slide.addText(`✓ ${correct}`, {
      x: 0.6, y: y + 0.38, w: 8.8, h: 0.28,
      fontSize: 11, color: '16a34a', fontFace: 'Calibri', bold: true,
    });
    slide.addText(others, {
      x: 0.6, y: y + 0.65, w: 8.8, h: 0.3,
      fontSize: 10, color: '94a3b8', fontFace: 'Calibri',
    });
  });
}

function addComplianceSummarySlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addText('ACT 157 Compliance Summary', {
    x: 0.5, y: 0.35, w: 9, h: 0.6,
    fontSize: 26, bold: true, color: WHITE, fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.0, w: 2.5, h: 0.06, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });

  const rules = [
    'Driver must be 21+ with a valid driver\'s license',
    'No felony convictions — no exceptions or timeframe limits',
    'Must complete ABC-approved delivery training',
    'Deliver only in wet counties within or adjoining the retailer\'s county',
    'Verify valid government-issued ID before every handoff',
    'Never leave an order unattended',
    'Refuse delivery if recipient appears intoxicated or cannot show ID',
    'Company must hold a Third-Party Delivery Permit from ABC ($500/yr)',
  ];

  rules.forEach((rule, i) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: 1.15 + i * 0.5, w: 0.36, h: 0.36,
      fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
    });
    slide.addText('✓', { x: 0.4, y: 1.16 + i * 0.5, w: 0.36, h: 0.34, fontSize: 12, color: BRAND_DARK, align: 'center', bold: true, fontFace: 'Calibri' });
    slide.addText(rule, {
      x: 0.9, y: 1.17 + i * 0.5, w: 8.8, h: 0.36,
      fontSize: 12, color: i < 2 ? BRAND_GOLD : 'cbd5e1', fontFace: 'Calibri',
      bold: i < 2,
    });
  });
}

function addClosingSlide(pptx) {
  const slide = pptx.addSlide();
  slide.background = { color: BRAND_DARK };

  slide.addText('Training Complete', {
    x: 0.5, y: 1.3, w: 9, h: 0.65,
    fontSize: 32, bold: true, color: WHITE, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('You are now certified to deliver alcohol responsibly under Arkansas ACT 157.', {
    x: 0.5, y: 2.1, w: 9, h: 0.5,
    fontSize: 16, color: 'aab4c4', align: 'center', fontFace: 'Calibri',
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 3.5, y: 2.75, w: 3, h: 0.05, fill: { color: BRAND_GOLD }, line: { color: BRAND_GOLD },
  });
  slide.addText('Questions?  Contact Alcohol Delivered Operations', {
    x: 0.5, y: 3.1, w: 9, h: 0.4,
    fontSize: 13, color: BRAND_GOLD, align: 'center', fontFace: 'Calibri',
  });
  slide.addText('Pine Bluff, AR  ·  Arkansas ABC Permit Holder', {
    x: 0.5, y: 3.55, w: 9, h: 0.35,
    fontSize: 12, color: '6b7280', align: 'center', fontFace: 'Calibri',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Generating AI images for all modules...');

    // Generate all images in parallel (one per slide per module)
    const allPrompts = MODULES.flatMap(m => m.imagePrompts);
    const imageResults = await Promise.all(
      allPrompts.map(async (prompt) => {
        try {
          const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
          const b64 = await urlToBase64(result.url);
          return b64;
        } catch (err) {
          console.warn('Image generation failed for prompt:', prompt, err.message);
          return null; // slide renders without image on failure
        }
      })
    );

    // Map flat image array back to modules
    let imgIdx = 0;
    const moduleImages = MODULES.map(m => {
      const imgs = imageResults.slice(imgIdx, imgIdx + m.imagePrompts.length);
      imgIdx += m.imagePrompts.length;
      return imgs;
    });

    console.log(`Images generated: ${imageResults.filter(Boolean).length} / ${allPrompts.length}`);

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'Alcohol Delivered';
    pptx.company = 'Alcohol Delivered';
    pptx.subject = 'Driver Training — Arkansas ACT 157 (2025)';
    pptx.title = 'Alcohol Delivered Driver Training';

    addTitleSlide(pptx);
    addAgendaSlide(pptx);

    MODULES.forEach((mod, modIdx) => {
      addSectionHeaderSlide(pptx, mod, modIdx + 1);
      mod.slides.forEach((s, sIdx) => {
        addContentSlideWithImage(
          pptx, s.heading, s.body, mod.title,
          sIdx + 1, mod.slides.length,
          moduleImages[modIdx][sIdx] || null
        );
      });
      addQuizSlide(pptx, mod.title, mod.quiz);
    });

    addComplianceSummarySlide(pptx);
    addClosingSlide(pptx);

    const base64 = await pptx.write({ outputType: 'base64' });

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    const file = new File([blob], 'AlcoholDelivered_DriverTraining_ACT157.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });

    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    console.log('PPTX with images generated and uploaded:', file_url);
    return Response.json({ success: true, download_url: file_url });

  } catch (error) {
    console.error('generateTrainingPPTX error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});