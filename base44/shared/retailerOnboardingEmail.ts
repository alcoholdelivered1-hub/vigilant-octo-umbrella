const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function buildOnboardingHTML(store) {
  const name = escapeHTML(store.name);
  const email = escapeHTML(store.email || '');
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">Alcohol Delivered</h1>
            <p style="margin:4px 0 0;color:#f59e0b;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Pine Bluff, Arkansas · ABC Licensed</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;">Welcome, ${name}! 🤝</h2>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">
              We're excited to welcome you as a retail partner with <strong>Alcohol Delivered</strong> — Pine Bluff's premier third-party alcohol delivery platform. We connect your store with customers across Jefferson County and surrounding wet areas, handling all delivery logistics, driver compliance, and age verification on your behalf.
            </p>
            <p style="margin:0 0 24px;color:#1e293b;font-size:15px;line-height:1.6;background:#f8fafc;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:0 8px 8px 0;">
              <strong>You remain the seller of record</strong> — we simply handle the last mile.
            </p>
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">How the Partnership Works</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">1.</strong> Customers browse your store and place orders through our app.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">2.</strong> You receive an instant notification with the full order details.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">3.</strong> You prepare and seal the order — ready for driver pickup.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">4.</strong> Our trained, ABC-compliant driver picks up and delivers to the customer.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">5.</strong> Customer ID is verified (21+) at both checkout and delivery.</td></tr>
              <tr><td style="padding:8px 0;color:#475569;font-size:14px;line-height:1.5;"><strong style="color:#1e3a5f;">6.</strong> You receive <strong>100% of the product subtotal</strong>. We earn only our service and delivery fees.</td></tr>
            </table>
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Your Store Details on File</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;width:120px;">Store Name</td><td style="padding:4px 0;color:#1e293b;font-size:14px;font-weight:600;">${name}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Address</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${escapeHTML(store.address || '')}, ${escapeHTML(store.city || '')}, ${escapeHTML(store.state || 'AR')} ${escapeHTML(store.zip_code || '')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">Phone</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${escapeHTML(store.phone || 'Not on file — please update')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">License #</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${escapeHTML(store.license_number || '')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;font-size:13px;">County</td><td style="padding:4px 0;color:#1e293b;font-size:14px;">${escapeHTML(store.county || '')}</td></tr>
            </table>
            <h3 style="margin:0 0 12px;color:#1e3a5f;font-size:16px;">Next Steps — Action Required</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#1e3a5f;border-radius:10px;padding:20px;text-align:center;">
                  <p style="margin:0 0 12px;color:#ffffff;font-size:14px;font-weight:600;">📋 Review & Sign Your Retailer Partner Agreement</p>
                  <a href="https://alcohol-delivered.biz/retailer-contract?store_id=${encodeURIComponent(store.id)}" style="display:inline-block;background:#f59e0b;color:#1e3a5f;padding:10px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;">View & Sign Agreement</a>
                </td>
              </tr>
              <tr><td style="height:12px;"></td></tr>
              <tr>
                <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;color:#1e293b;font-size:14px;font-weight:600;">📦 Upload Your Inventory</p>
                  <p style="margin:0;color:#64748b;font-size:13px;">Add your products so customers can browse and order. Visit your <a href="https://alcohol-delivered.biz/retailer-portal" style="color:#1e3a5f;text-decoration:none;font-weight:600;">Partner Portal</a> to get started.</p>
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
            <h3 style="margin:0 0 8px;color:#1e3a5f;font-size:16px;">Compliance & Your Obligations</h3>
            <p style="margin:0 0 20px;color:#475569;font-size:13px;line-height:1.6;">
              Under Arkansas ACT 157, as the licensed retailer you are responsible for preparing orders accurately, sealing them for delivery, ensuring all products are legally available for off-premise sale, and maintaining your valid ABC retail license in good standing. We handle driver training, ID verification, delivery logs, and all third-party delivery compliance on your behalf.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:8px;">
              <tr>
                <td style="color:#1e3a5f;font-size:14px;font-weight:600;padding-bottom:8px;">Questions? Contact John Bess directly: <a href="tel:+18707181521" style="color:#1e3a5f;">870-718-1521</a></td>
              </tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">✉️ <a href="mailto:alcohol.delivered1@gmail.com" style="color:#1e3a5f;text-decoration:none;">alcohol.delivered1@gmail.com</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">🌐 <a href="https://alcohol-delivered.biz" style="color:#1e3a5f;text-decoration:none;">alcohol-delivered.biz</a></td></tr>
              <tr><td style="color:#475569;font-size:13px;padding:2px 0;">📍 Pine Bluff, AR — Jefferson County</td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#1e3a5f;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
              Alcohol Delivered, LLC · Pine Bluff, AR · alcohol-delivered.biz<br>
              This email was sent to ${email} as part of our retailer onboarding program.<br>
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