const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function retailerLaunchInstructionsEmail(store, appOrigin) {
  const tracker = `${appOrigin}/onboarding?store_id=${encodeURIComponent(store.id)}`;
  const dashboard = `${appOrigin}/store/dashboard`;
  return `<html><body style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:24px auto;padding:16px;color:#172033">
    <h1>${escapeHtml(store.name)} is live</h1>
    <p>Hello ${escapeHtml(store.name)} team,</p>
    <p>Your onboarding and required launch checks are complete, and your store is now enabled to receive orders through Alcohol Delivered.</p>
    <h2>Final setup and operating instructions</h2>
    <ol>
      <li>Sign in with your saved store contact email, ${escapeHtml(store.email)}, and <a href="${dashboard}">open your Store Dashboard</a>. Keep it available during operating hours to review incoming orders.</li>
      <li>Confirm the correct store is selected. Review your contact information, pickup address, store hours, and notification settings.</li>
      <li>Keep real inventory, shelf prices, and availability current through your authorized POS or inventory workflow.</li>
      <li>Review each order and its payment status before confirming availability and preparing it. Do not charge an already-paid customer again.</li>
      <li>Follow the dashboard’s order-status controls and coordinate pickup with the assigned authorized driver. Keep orders sealed and ready for handoff; alcohol deliveries require the applicable age and identity checks.</li>
      <li>Use your <a href="${tracker}">store onboarding tracker</a> for setup records and secure forms. Do not send passwords, access tokens, banking details, or identity documents by email.</li>
    </ol>
    <p>Need help? Reply to this email or contact John Bess directly at <a href="tel:+18707181521">870-718-1521</a>.</p>
    <p>Alcohol Delivered</p>
  </body></html>`;
}