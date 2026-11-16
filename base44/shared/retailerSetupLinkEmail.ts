const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export function retailerSetupLinkEmail(store, recipientEmail = store.email, includeStorefront = false) {
  const url = `https://alcohol-delivered.biz/onboarding?store_id=${encodeURIComponent(store.id)}`;
  const agreementUrl = `https://alcohol-delivered.biz/retailer-contract?store_id=${encodeURIComponent(store.id)}`;
  return `<html><body style="font-family:Arial,sans-serif;line-height:1.6;max-width:620px;margin:24px auto;padding:16px;color:#172033">
    <h1>${escapeHtml(store.name)}: retailer onboarding</h1>
    <p>Hello ${escapeHtml(store.name)} team,</p>
    ${includeStorefront ? `<p>Your individual Alcohol Delivered storefront is ready for your review.</p><p><a href="https://alcohol-delivered.biz/stores/${encodeURIComponent(store.id)}">View your storefront</a></p><p>Please review your storefront details and complete the secure onboarding below. This is a preview, not confirmation that your store is accepting orders.</p>` : ''}
    <p>We would like to help you complete your store setup with Alcohol Delivered. Please have your owner or authorized manager confirm participation and review the retailer agreement.</p>
    <p><a href="${agreementUrl}">Review your store-specific retailer agreement</a></p>
    <p><a href="${url}">Open your store onboarding tracker</a></p>
    <p>${url}</p>
    <p>Sign in using your store contact email, ${escapeHtml(recipientEmail)}, so the tracker can find your store. If a different owner or manager should handle setup, reply with the preferred contact before proceeding.</p>
    <ol>
      <li>Confirm your contact information, store hours, and ABC retail license number and expiration. Upload the license privately in your tracker.</li>
      <li>Review the store-specific agreement, print and sign it, then upload the signed copy privately for review.</li>
      <li>Complete the secure payment onboarding requested in the tracker.</li>
      <li>Upload your actual inventory/POS export and identify your POS provider. Our team handles catalog preparation; authorized POS data remains the source of truth for prices and availability. Do not email access credentials.</li>
      <li>Coordinate with Alcohol Delivered on tax review, notifications, and a sandbox order and delivery-handoff test.</li>
    </ol>
    <p>This invitation does not activate customer ordering or certify launch readiness. Launch requires verified setup and completion of the final checks.</p>
    <p>Please reply if you need assistance. Do not email passwords, access tokens, bank information, or identity documents; use the secure setup forms.</p>
    <p>Contact John Bess directly: <a href="tel:+18707181521">870-718-1521</a></p>
    <p>Alcohol Delivered</p>
  </body></html>`;
}