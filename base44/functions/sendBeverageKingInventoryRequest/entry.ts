/**
 * sendBeverageKingInventoryRequest
 * Admin-only. Emails Beverage King a request to export a real CSV/XLSX
 * inventory file from their Clover POS. Sent via the connected Gmail
 * connector so it reaches the retailer's address even if they are not a
 * registered app user.
 * POST body: {} (sends to BEVKING71603@GMAIL.COM)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const BEVERAGE_KING_STORE_ID = '6a32d14d09b760f592dbf19e';
const RECIPIENT = 'BEVKING71603@GMAIL.COM';
const SUPPORT_PHONE = '870-718-1521';

function buildRawEmail(to, subject, body, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const store = await base44.asServiceRole.entities.Store.get(BEVERAGE_KING_STORE_ID);
    const to = (store?.email || '').trim() || RECIPIENT;

    const subject = 'Action needed: export your Clover inventory file for Alcohol Delivered';

    const body = `Hello ${store?.name || 'Beverage King'} Team,

To get your real products live on Alcohol Delivered, please export your current product inventory from your Clover POS as a CSV or Excel file.

The export should include, for each item:
  • Product name
  • UPC / SKU
  • Price
  • Category
  • Stock quantity

Once you have the file, just reply to this email with it attached. We will review it carefully before anything goes live — we will NOT change prices, delete products, or import anything until we have received and reviewed the real file.

If you have any questions, you can call us at ${SUPPORT_PHONE}. If there is no answer, please leave a message and we will get back to you.

Thank you,
Alcohol Delivered Operations Team
alcohol-delivered.biz`;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const raw = buildRawEmail(to, subject, body, 'Alcohol Delivered');
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    if (!gmailRes.ok) {
      const errBody = await gmailRes.text();
      throw new Error(`Gmail API error: ${gmailRes.status} — ${errBody}`);
    }

    const gmailData = await gmailRes.json().catch(() => ({}));
    console.log(`Inventory request sent to ${to} (gmail id ${gmailData.id || 'n/a'})`);

    return Response.json({
      sent: true,
      to,
      store_name: store?.name,
      gmail_id: gmailData.id || null,
    });
  } catch (error) {
    console.error('[sendBeverageKingInventoryRequest] error:', error.message);
    return Response.json({ sent: false, to: RECIPIENT, error: error.message }, { status: 500 });
  }
}