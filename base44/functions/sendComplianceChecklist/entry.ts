import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { assertAdmin } from '../../shared/authGuard.ts';

const CHECKLIST = [
  { id: 'A', title: 'Third-Party Delivery Permit', items: ['Apply with Arkansas Alcoholic Beverage Control (ABC)', 'Pay required annual fee (~$500)', 'Must be approved before operating'] },
  { id: 'B', title: 'Business Registration', items: ['Register LLC or Corporation in Arkansas', 'Be in good standing with Secretary of State'] },
  { id: 'C', title: 'Eligibility', items: ['Can be individual, LLC, or corporation', 'Cannot be a manufacturer or wholesaler'] },
  { id: 'D', title: 'Retailer Partnerships', items: ['Must contract with licensed retailers (liquor stores, grocery stores, etc.)', 'You do NOT sell alcohol — retailer remains seller'] },
  { id: 'E', title: 'Driver Requirements', items: ['Must be 21+', 'Valid driver\'s license', 'No felony convictions'] },
  { id: 'F', title: 'Driver Model', items: ['Employees allowed', 'Independent contractors allowed'] },
  { id: 'G', title: 'Training Program', items: ['Create alcohol safety training', 'Must include ID checks, intoxication rules, fake ID detection', 'Submit to ABC for approval'] },
  { id: 'H', title: 'Age Verification', items: ['Check valid government-issued ID at delivery', 'Customer must be 21+', 'Refuse delivery if underage or intoxicated'] },
  { id: 'I', title: 'Delivery Rules', items: ['Deliver only from licensed retailer to customer', 'Must be a legitimate order'] },
  { id: 'J', title: 'Delivery Area', items: ['Same county or adjacent wet county only'] },
  { id: 'K', title: 'Wet/Dry Compliance', items: ['Deliver only in legal (wet) areas'] },
  { id: 'L', title: 'Delivery Hours', items: ['Only during legal alcohol sale hours', 'Delivery must occur promptly after pickup'] },
  { id: 'M', title: 'Order Requirements', items: ['Must be placed by person 21+', 'Delivered to buyer or another person age 21+'] },
  { id: 'N', title: 'Liability', items: ['You are responsible for delivery compliance', 'Retailer is not liable for your violations'] },
  { id: 'O', title: 'Contracts', items: ['Written agreements with retailers required', 'Must define roles, liability, and payment structure'] },
  { id: 'P', title: 'Payments', items: ['Platform or retailer can process payment', 'Retailer remains legal seller'] },
  { id: 'Q', title: 'Insurance', items: ['General liability insurance', 'Commercial auto insurance', 'Liquor liability insurance (strongly recommended)'] },
  { id: 'R', title: 'Recordkeeping', items: ['Maintain delivery logs', 'Keep ID verification records', 'Track order timestamps'] },
  { id: 'S', title: 'Technology', items: ['App/system for order tracking', 'ID verification process', 'Retailer integration'] },
  { id: 'T', title: 'Inventory Rule', items: ['Cannot own or resell alcohol', 'Only deliver retailer\'s product'] },
  { id: 'U', title: 'Packaging', items: ['Must be sealed by retailer', 'No open containers'] },
  { id: 'V', title: 'Vehicles', items: ['Registered and insured', 'No open alcohol in driver area'] },
  { id: 'W', title: 'Local Requirements (Pine Bluff)', items: ['City business license', 'Zoning compliance if operating facility'] },
  { id: 'X', title: 'Taxes', items: ['Retailer pays alcohol taxes', 'You pay business/income taxes on fees'] },
  { id: 'Y', title: 'Penalties', items: ['Fines, suspension, or revocation by ABC for violations'] },
  { id: 'Z', title: 'Final Approval', items: ['ABC permit approved', 'Training program approved', 'Retail contracts signed before launch'] },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { authorized, response } = await assertAdmin(base44);
    if (!authorized) return response;

    const sectionsHtml = CHECKLIST.map(section => `
      <tr>
        <td colspan="2" style="padding: 0; padding-top: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <tr style="background-color: #1e3a8a;">
              <td style="padding: 10px 14px;">
                <span style="display:inline-block; background:#3b5fd4; color:white; font-weight:700; font-size:12px; border-radius:4px; padding:2px 8px; margin-right:8px;">${section.id}</span>
                <span style="color:white; font-weight:600; font-size:14px;">${section.title}</span>
              </td>
            </tr>
            ${section.items.map(item => `
            <tr style="border-top: 1px solid #f1f5f9;">
              <td style="padding: 8px 14px; font-size: 13px; color: #374151; vertical-align: top;">
                <span style="display:inline-block; width:18px; height:18px; border:2px solid #d1d5db; border-radius:3px; margin-right:10px; vertical-align:middle;"></span>${item}
              </td>
            </tr>`).join('')}
          </table>
        </td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f8fafc; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px; width:100%; background:white; border-radius:12px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr style="background: #1e3a8a;">
            <td style="padding: 28px 32px;">
              <p style="margin:0; color:#93c5fd; font-size:12px; text-transform:uppercase; letter-spacing:1px; font-weight:600;">Alcohol Delivered, LLC</p>
              <h1 style="margin:6px 0 0; color:white; font-size:22px; font-weight:700;">Arkansas Third-Party Alcohol Delivery</h1>
              <h2 style="margin:4px 0 0; color:#bfdbfe; font-size:16px; font-weight:400;">Compliance Checklist</h2>
              <p style="margin:10px 0 0; color:#93c5fd; font-size:12px;">Pine Bluff / Jefferson County · Updated for 2025 Arkansas Law · No sign-in required</p>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding: 24px 32px 8px;">
              <p style="margin:0; font-size:14px; color:#374151; line-height:1.6;">
                Dear Drew Cousins,<br><br>
                Please find below the current compliance checklist for <strong>Alcohol Delivered, LLC</strong> operating under Arkansas ACT 157 for third-party alcohol delivery. This document outlines all operational, legal, and regulatory requirements. No login is required to view this checklist.
              </p>
              <p style="margin:12px 0 0; font-size:12px; color:#6b7280;">
                Sent: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT
              </p>
            </td>
          </tr>

          <!-- Checklist Sections -->
          <tr>
            <td style="padding: 8px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${sectionsHtml}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr style="background:#f1f5f9; border-top: 1px solid #e2e8f0;">
            <td style="padding: 20px 32px;">
              <p style="margin:0; font-size:12px; color:#6b7280;">
                This checklist was sent from the Alcohol Delivered compliance management system.<br>
                Questions? Contact us at <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a8a;">alcohol.delivered1@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const recipientEmail = 'Drew.Cousins@dfa.arkansas.gov';

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipientEmail,
      subject: 'Arkansas Third-Party Alcohol Delivery Compliance Checklist — Alcohol Delivered, LLC',
      body: html,
      from_name: 'Alcohol Delivered — Compliance',
    });

    console.log(`Compliance checklist sent to ${recipientEmail}`);
    return Response.json({ success: true, sent_to: recipientEmail });
  } catch (error) {
    console.error('sendComplianceChecklist error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});