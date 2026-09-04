import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Build a base64url-encoded RFC 2822 HTML email for Gmail API
function buildRawEmail(to, subject, htmlBody, fromName) {
  const fromHeader = `${fromName} <alcohol.delivered1@gmail.com>`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join('\r\n');
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildOnboardingHTML(store, note) {
  const noteBanner = note ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <tr><td style="color:#166534;font-size:14px;font-weight:600;line-height:1.5;">
                ✅ ${note}
              </td></tr>
            </table>` : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Alcohol Delivered</h1>
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Pine Bluff, Arkansas · ABC Licensed</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            ${noteBanner}
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Welcome, ${store.name}! 🤝</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              We're excited to welcome you as a retail partner with <strong>Alcohol Delivered</strong> — Pine Bluff's premier third-party alcohol delivery platform. We connect your store with customers across Jefferson County and surrounding wet areas, handling all delivery logistics, driver compliance, and age verification on your behalf.
            </p>
            <p style="margin:0 0 24px;color:#1e293b;font-size:15px;line-height:1.6;background:#f8fafc;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;">
              <strong>You remain the seller of record</strong> — we simply handle the last mile.
            </p>

            <!-- How It Works -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">How the Partnership Works</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">1.</strong> Customers browse your store and place orders through our app.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">2.</strong> You receive an instant notification with the full order details.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">3.</strong> You prepare and seal the order — ready for driver pickup.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">4.</strong> Our trained, ABC-compliant driver picks up and delivers to the customer.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">5.</strong> Customer ID is verified (21+) at both checkout and delivery.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">6.</strong> You receive <strong>100% of the product subtotal</strong>. We earn only our service and delivery fees.</td></tr>
            </table>

            <!-- Store Details -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Your Store Details on File</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:120px;">Store Name</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${store.name}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Address</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.address}, ${store.city}, ${store.state} ${store.zip_code || ''}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.phone || 'Not on file — please update'}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">License #</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.license_number}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">County</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${store.county}</td></tr>
            </table>

            <!-- Next Steps -->
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Next Steps — Action Required</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:10px;padding:20px;text-align:center;">
                  <p style="margin:0 0 12px;color:#ffffff;font-size:14px;font-weight:600;">📋 Review & Sign Your Retailer Partner Agreement</p>
                  <a href="https://alcohol-delivered.biz/retailer-contract?store=${store.id}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;">View & Sign Agreement</a>
                </td>
              </tr>
              <tr><td style="height:12px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#1e293b;font-size:14px;font-weight:600;">📦 Upload Your Inventory</p>
                  <p style="margin:0;color:#64748b;font-size:13px;">Add your products so customers can browse and order. Visit your <a href="https://alcohol-delivered.biz/store/dashboard" style="color:#1e3a5f;text-decoration:none;font-weight:600;">Partner Portal</a> to get started.</p>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#1e293b;font-size:14px;font-weight:600;">✅ Confirm Your Contact Email</p>
                  <p style="margin:0;color:#64748b;font-size:13px;">All order notifications will be sent to this address. If incorrect, simply reply to this email.</p>
                </td>
              </tr>
            </table>

            <!-- Compliance -->
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Compliance & Your Obligations</h3>
            <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
              Under Arkansas ACT 157, as the licensed retailer you are responsible for preparing orders accurately, sealing them for delivery, ensuring all products are legally available for off-premise sale, and maintaining your valid ABC retail license in good standing. We handle driver training, ID verification, delivery logs, and all third-party delivery compliance on your behalf.
            </p>

            <!-- Contact -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr>
                <td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? We're here to help.</td>
              </tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">📍 Pine Bluff, AR — Jefferson County</td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${store.email} as part of our retailer onboarding program.<br>
              Operating under Arkansas ACT 157 with a valid ABC Third-Party Delivery Permit.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const payload = await req.json();

    // Support both direct calls (store_id/county/city) and entity automation calls (event.entity_id)
    const isAutomation = payload?.event?.type === 'create' && payload?.event?.entity_name === 'Store';

    if (!isAutomation) {
      const user = await base44.auth.me().catch(() => null);
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
      }
    }

    const { county, city, store_id: directStoreId, note, exclude_store_ids, only_pending } = payload;
    const store_id = isAutomation ? payload.event.entity_id : directStoreId;

    // Fetch all stores and filter by store_id, county, or city
    const allStores = await base44.asServiceRole.entities.Store.list();
    const exclude = new Set((exclude_store_ids || []).map(String));
    const stores = allStores.filter(s => {
      if (!s.email) return false;
      if (exclude.has(s.id)) return false;
      if (store_id) return s.id === store_id;
      if (only_pending && (s.onboarding_status || 'invited') === 'live') return false;
      const countyMatch = !county || (s.county || '').toLowerCase() === county.toLowerCase();
      const cityMatch = !city || (s.city || '').toLowerCase() === city.toLowerCase();
      return countyMatch && cityMatch;
    });

    if (stores.length === 0) {
      return Response.json({ skipped: true, reason: 'No stores found with email for the given filters' });
    }

    // Get Gmail OAuth access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    const results = [];

    for (const store of stores) {
      const subject = `Welcome to Alcohol Delivered — Partner Onboarding for ${store.name}`;
      const htmlBody = buildOnboardingHTML(store, note);

      try {
        const raw = buildRawEmail(store.email, subject, htmlBody, 'Alcohol Delivered');

        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Gmail API error: ${res.status} — ${errBody}`);
        }

        console.log(`Onboarding email sent to ${store.name} <${store.email}>`);

        // Auto-advance onboarding stage from "invited" to "contract_sent"
        if ((store.onboarding_status || 'invited') === 'invited') {
          await base44.asServiceRole.entities.Store.update(store.id, {
            onboarding_status: 'contract_sent',
            contract_sent_at: new Date().toISOString(),
          }).catch((e) => console.error(`Failed to advance stage for ${store.name}: ${e.message}`));
        }

        await base44.asServiceRole.integrations.Core.TrackEvent({
          event_name: 'retailer_onboarding_email_sent',
          properties: {
            store_id: store.id,
            store_name: store.name,
            store_email: store.email,
            county: store.county || '',
            city: store.city || '',
            triggered_by: isAutomation ? 'automation' : 'admin',
          },
        }).catch(() => {});
        results.push({ store: store.name, email: store.email, status: 'sent' });
      } catch (err) {
        console.error(`Failed to send to ${store.name}: ${err.message}`);
        results.push({ store: store.name, email: store.email, status: 'failed', error: err.message });
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return Response.json({ success: true, sent, failed, results });

  } catch (error) {
    console.error('Onboarding email error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});