/**
 * sendBeverageKingStripeReconnectEmail
 * Admin-only. One-time email to Beverage King's owner (Bobby Singh) with the
 * steps to clear Stripe's fraud-review restriction on acct_1UID6HK2X4PvQU84
 * and finish verification. Sent via the connected Gmail connector, same
 * pattern as sendBeverageKingInventoryRequest.
 * POST body: {} (sends to the store's own email, falls back to BEVKING71603@GMAIL.COM)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

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

    const subject = 'Action needed: reconnect your Stripe account to receive payments';

    const body = `Hi Bobby,

We're ready to go live with Beverage King on Alcohol Delivered — your agreement, licenses, inventory, and everything else are all set. The one remaining step is your Stripe account, which needs your attention before we can send you any payments.

Stripe has restricted your account (acct_1UID6HK2X4PvQU84) and is requesting additional verification before it can accept charges or send payouts. Here's what to do:

1. Go to https://dashboard.stripe.com and log in with the email you used to set up your account (bevking71603@gmail.com).
2. Once logged in, Stripe will show a notice about your account needing verification/appeal — follow its prompts.
3. You'll need to provide:
   - Your business address and phone number
   - Your own information as the business representative: full name, date of birth, last 4 of SSN, home address, phone, and email
   - Your business tax ID (EIN)
   - Your bank account and routing number for deposits
   - Acceptance of Stripe's Terms of Service
4. Submit the verification/appeal form Stripe presents.

Once Stripe clears your account, let us know and we'll do a final check on our end before your store goes fully live.

If you run into any trouble or have questions, just reply to this email or call us at ${SUPPORT_PHONE}.

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
    console.log(`Stripe reconnect email sent to ${to} (gmail id ${gmailData.id || 'n/a'})`);

    return Response.json({
      sent: true,
      to,
      store_name: store?.name,
      gmail_id: gmailData.id || null,
    });
  } catch (error) {
    console.error('[sendBeverageKingStripeReconnectEmail] error:', error.message);
    return Response.json({ sent: false, to: RECIPIENT, error: error.message }, { status: 500 });
  }
}
